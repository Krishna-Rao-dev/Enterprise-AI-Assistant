import os
from dotenv import load_dotenv

load_dotenv()

# Paths
POLICIES_GLOB = os.getenv("POLICIES_GLOB", "docs/policies/*.md")
REPO_DOCS_GLOB = os.getenv("REPO_DOCS_GLOB", "docs/repos/*.md")
CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")

# Models
EMB_MODEL = "BAAI/bge-small-en-v1.5"
RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

# Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# PostgreSQL
PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql+asyncpg://postgres:password@localhost:5432/enterprise_rag"
)

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "enterprise_rag")

# ACL
VALID_GROUPS = {
    "all_employees", "engineering", "hr", "hr_managers",
    "finance", "legal", "it_admin", "executives", "contractors"
}
REQUIRED_POLICY_FIELDS = ["doc_id", "title", "status", "version", "last_updated", "allowed_groups"]
REQUIRED_REPO_FIELDS   = ["doc_id", "title", "repo", "allowed_groups"]
