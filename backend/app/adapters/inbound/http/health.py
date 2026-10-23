from fastapi import APIRouter

from app.config import GEMINI_MODEL, MOCK_AGENTS, MOCK_GITHUB

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"ok": True, "model": GEMINI_MODEL, "mock": MOCK_AGENTS, "mock_github": MOCK_GITHUB}
