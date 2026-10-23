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

# Sin credenciales caemos a mock para que el front pueda trabajar igual.
MOCK_AGENTS = os.getenv("MOCK_AGENTS", "").lower() in ("1", "true") or not _has_credentials
