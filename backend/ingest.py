"""
ingest.py — Build (or rebuild) the ChromaDB from:
  1. Policy/HR docs  → docs/policies/*.md
  2. Repo docs       → docs/repos/*.md

Run once before starting the server:
    python ingest.py

Repo doc front-matter example:
─────────────────────────────────────────────────
---
doc_id: REPO-AUTH-001
title: "Auth Service — Developer Guide"
repo: auth-service            # repo slug (must match repo_access table)
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-09-01"
---
─────────────────────────────────────────────────

Ownership: the `repo` field scopes retrieval. Users also need to be in
one of the `allowed_groups`. So a contractor in `engineering` can only
see repo docs where `engineering` is in allowed_groups AND they belong
to the repo. Finer-grained ownership can be added via the `repo_access`
PostgreSQL table (group → repo mapping), enforced in retrieval.py.
"""

import glob
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

import frontmatter
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

from app.config import (
    CHROMA_DIR, EMB_MODEL, POLICIES_GLOB, REPO_DOCS_GLOB,
    REQUIRED_POLICY_FIELDS, REQUIRED_REPO_FIELDS, VALID_GROUPS,
)

# ── config ───────────────────────────────────────────────────────────────────

# ── splitters ────────────────────────────────────────────────────────────────

md_split   = MarkdownHeaderTextSplitter(
    headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")]
)
char_split = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
TABLE_RE   = re.compile(r"(?:^[ \t]*\|.*\|[ \t]*\n?)+", re.MULTILINE)


# ── helpers ──────────────────────────────────────────────────────────────────

def validate_policy(m, path):
    missing = [k for k in REQUIRED_POLICY_FIELDS if k not in m]
    if missing:
        raise ValueError(f"{path}: missing required fields {missing}")
    if not m["allowed_groups"]:
        raise ValueError(f"{path}: allowed_groups must not be empty")
    bad = set(m["allowed_groups"]) - VALID_GROUPS
    if bad:
        raise ValueError(f"{path}: unknown groups {sorted(bad)}")


def validate_repo(m, path):
    missing = [k for k in REQUIRED_REPO_FIELDS if k not in m]
    if missing:
        raise ValueError(f"{path}: missing required fields {missing}")
    if not m["allowed_groups"]:
        raise ValueError(f"{path}: allowed_groups must not be empty")
    bad = set(m["allowed_groups"]) - VALID_GROUPS
    if bad:
        raise ValueError(f"{path}: unknown groups {sorted(bad)}")


def split_tables(text):
    tables = [m.group(0).strip() for m in TABLE_RE.finditer(text)]
    return TABLE_RE.sub("", text), tables


def table_chunks(table, max_rows=15):
    lines = table.split("\n")
    if len(lines) < 3:
        yield table
        return
    header, sep, rows = lines[0], lines[1], lines[2:]
    for i in range(0, len(rows), max_rows):
        yield "\n".join([header, sep] + rows[i:i + max_rows])


def build_meta(m: dict, section: str, is_table: bool, source_type: str) -> dict:
    """Build the metadata dict attached to every chunk."""
    meta = {
        "doc_id":         m["doc_id"],
        "title":          m["title"],
        "status":         str(m.get("status", "current")),
        "version":        str(m.get("version", "1.0")),
        "last_updated":   str(m.get("last_updated", "")),
        "allowed_groups": ",".join(m["allowed_groups"]),
        "section":        section,
        "is_table":       is_table,
        "source_type":    source_type,   # "policy" | "repo"
    }
    if source_type == "repo":
        meta["repo"] = m["repo"]
    for g in m["allowed_groups"]:
        meta[f"grp_{g}"] = True
    return meta


def doc_to_chunks(path: str, source_type: str) -> list[Document]:
    post = frontmatter.load(path)
    m    = post.metadata

    if source_type == "policy":
        validate_policy(m, path)
    else:
        validate_repo(m, path)

    out = []
    for sec in md_split.split_text(post.content):
        body, tables = split_tables(sec.page_content)
        sec.page_content = body
        section = sec.metadata.get("h2", sec.metadata.get("h1", ""))

        pieces = [p for p in char_split.split_documents([sec]) if p.page_content.strip()]
        for t in tables:
            for part in table_chunks(t):
                pieces.append(Document(page_content=part, metadata=dict(sec.metadata)))

        for c in pieces:
            c.metadata = build_meta(m, section, c.page_content.lstrip().startswith("|"), source_type)
            c.page_content = f"{m['title']} | {section}\n{c.page_content}"
            out.append(c)
    return out


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    policy_paths = sorted(glob.glob(POLICIES_GLOB))
    repo_paths   = sorted(glob.glob(REPO_DOCS_GLOB))

    if not policy_paths and not repo_paths:
        print("No docs found. Check POLICIES_GLOB and REPO_DOCS_GLOB.")
        sys.exit(1)

    all_chunks: list[Document] = []

    print(f"Ingesting {len(policy_paths)} policy docs...")
    for p in policy_paths:
        chunks = doc_to_chunks(p, "policy")
        all_chunks.extend(chunks)
        print(f"  {Path(p).name}: {len(chunks)} chunks")

    print(f"\nIngesting {len(repo_paths)} repo docs...")
    for p in repo_paths:
        chunks = doc_to_chunks(p, "repo")
        all_chunks.extend(chunks)
        print(f"  {Path(p).name}: {len(chunks)} chunks (repo={frontmatter.load(p).metadata.get('repo')})")

    print(f"\nTotal: {len(all_chunks)} chunks "
          f"({sum(c.metadata['is_table'] for c in all_chunks)} table chunks)")

    # ── sanity: ACL ──
    bad = [c for c in all_chunks if not c.metadata["allowed_groups"]]
    if bad:
        raise ValueError(f"{len(bad)} chunks have no allowed_groups")

    # ── build ChromaDB ──
    print("\nBuilding ChromaDB (this embeds everything)...")
    target = Path(CHROMA_DIR)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f"{target.name}.staging-", dir=target.parent))
    backup = target.with_name(f"{target.name}.backup")
    emb = HuggingFaceEmbeddings(model_name=EMB_MODEL)
    try:
        vs = Chroma.from_documents(
            all_chunks, emb, persist_directory=str(temporary)
        )
        count = vs._collection.count()
        if count != len(all_chunks):
            raise RuntimeError(
                f"ChromaDB contains {count} vectors for {len(all_chunks)} chunks"
            )
        del vs
        if backup.exists():
            shutil.rmtree(backup)
        if target.exists():
            os.replace(target, backup)
        try:
            os.replace(temporary, target)
        except OSError:
            if backup.exists() and not target.exists():
                os.replace(backup, target)
            raise
        if backup.exists():
            shutil.rmtree(backup)
    except Exception:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise
    print(f"ChromaDB built: {count} vectors in '{target}/'")

    # ── summary ──
    from collections import Counter
    by_type  = Counter(c.metadata["source_type"] for c in all_chunks)
    by_repo  = Counter(c.metadata.get("repo", "—") for c in all_chunks)
    by_group = Counter()
    seen_docs = set()
    for c in all_chunks:
        if c.metadata["doc_id"] in seen_docs: continue
        seen_docs.add(c.metadata["doc_id"])
        for g in c.metadata["allowed_groups"].split(","):
            by_group[g] += 1

    print("\n── Summary ────────────────────────")
    print("chunks by type: ", dict(by_type))
    print("chunks by repo: ", dict(by_repo))
    print("docs per group: ", dict(by_group))
    print("────────────────────────────────────")
    print("Done. Start the server with: uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
