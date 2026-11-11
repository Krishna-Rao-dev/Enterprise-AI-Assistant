import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent


def _configured_path(value: str, base: Path) -> str:
    path = Path(value)
    return str(path if path.is_absolute() else base / path)


POLICIES_GLOB = _configured_path(
    os.getenv("POLICIES_GLOB", "docs/policies/*.md"), PROJECT_DIR
)
REPO_DOCS_GLOB = _configured_path(
    os.getenv("REPO_DOCS_GLOB", "docs/repos/*.md"), PROJECT_DIR
)
CHROMA_DIR = _configured_path(os.getenv("CHROMA_DIR", "chroma_db"), BACKEND_DIR)

EMB_MODEL = os.getenv("EMB_MODEL", "BAAI/bge-small-en-v1.5")
RERANK_MODEL = os.getenv(
    "RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
)
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

JIRA_BASE_URL = os.getenv("JIRA_BASE_URL", "")
JIRA_EMAIL = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")
JIRA_DEFAULT_PROJECT = os.getenv("JIRA_DEFAULT_PROJECT", "")
JIRA_CREDENTIALS_JSON = os.getenv("JIRA_CREDENTIALS_JSON", "")
if JIRA_CREDENTIALS_JSON:
    jira_credentials = json.loads(JIRA_CREDENTIALS_JSON)
    JIRA_BASE_URL = jira_credentials.get("base_url", JIRA_BASE_URL)
    JIRA_EMAIL = jira_credentials.get("email", JIRA_EMAIL)
    JIRA_API_TOKEN = jira_credentials.get("api_token", JIRA_API_TOKEN)
    JIRA_DEFAULT_PROJECT = jira_credentials.get(
        "default_project", JIRA_DEFAULT_PROJECT
    )

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/enterprise_rag",
)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "enterprise_rag")

VALID_GROUPS = {
    "all_employees", "engineering", "hr", "hr_managers",
    "finance", "legal", "it_admin", "executives", "contractors"
}
REQUIRED_POLICY_FIELDS = [
    "doc_id", "title", "status", "version", "last_updated", "allowed_groups"
]
REQUIRED_REPO_FIELDS = ["doc_id", "title", "repo", "allowed_groups"]
