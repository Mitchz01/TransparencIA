import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("agile")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agile.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

_has_credentials = bool(
    os.getenv("GOOGLE_API_KEY")
    or os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true")
)

# Without credentials we fall back to mock so the frontend can keep working.
MOCK_AGENTS = os.getenv("MOCK_AGENTS", "").lower() in ("1", "true") or not _has_credentials
# Seconds each mock agent "thinks", so the UI shows progress; tests set it to 0.
MOCK_AGENTS_DELAY = float(os.getenv("MOCK_AGENTS_DELAY", "0.8"))

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
# Without a token we use FakeCodeHost: it records actions in memory instead of calling GitHub.
MOCK_GITHUB = os.getenv("MOCK_GITHUB", "").lower() in ("1", "true") or not GITHUB_TOKEN
