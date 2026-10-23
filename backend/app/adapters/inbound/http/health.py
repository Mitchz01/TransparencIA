from fastapi import APIRouter

from app.config import GEMINI_MODEL, MOCK_AGENTS

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    return {"ok": True, "model": GEMINI_MODEL, "mock": MOCK_AGENTS}
