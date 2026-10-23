import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("agile")

# "dev" mounts development-only endpoints, e.g. replaying GitHub events (spec 008, T029).
ENV = os.getenv("ENV", "").lower()

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
# How many epic specs the writer asks Gemini for at once (spec 006, T029).
DOCUMENTS_CONCURRENCY = max(1, int(os.getenv("DOCUMENTS_CONCURRENCY", "3")))

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
# Without a token we use FakeCodeHost: it records actions in memory instead of calling GitHub.
MOCK_GITHUB = os.getenv("MOCK_GITHUB", "").lower() in ("1", "true") or not GITHUB_TOKEN
# MOCK_GITHUB=1 also ignores the projects' own tokens: every project gets FakeCodeHost (spec 007).
MOCK_GITHUB_FORCED = os.getenv("MOCK_GITHUB", "").lower() in ("1", "true")
# Public URL GitHub can reach; webhooks are registered at {PUBLIC_BASE_URL}/webhooks/github (spec 007).
# Empty = repos are connected without a webhook (local dev without a tunnel).
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
# Full webhook URL when it isn't {PUBLIC_BASE_URL}/webhooks/github, e.g. a smee.io channel in dev.
GITHUB_WEBHOOK_URL = os.getenv("GITHUB_WEBHOOK_URL", "")
# Optional key to encrypt the projects' GitHub tokens at rest (Fernet); empty = stored in plain text.
SECRET_KEY = os.getenv("SECRET_KEY", "")
# Spec 015: the session cookie only travels over HTTPS when set (Cloud Run); off for local dev.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "").lower() in ("1", "true")
# Spec 017: the public app's origin for the portal's link and QR, e.g. the tunnel's https URL.
# Empty = the link is relative ("/p/{slug}") and the frontend prefixes its own origin.
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "").rstrip("/")
# Spec 017 (D13): the generated software specs and diagrams (spec 006) are off unless turned on.
GENERATE_DOCUMENTS = os.getenv("GENERATE_DOCUMENTS", "").lower() in ("1", "true")
