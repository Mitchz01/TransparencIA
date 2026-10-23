from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, GEMINI_MODEL, MOCK_AGENTS
from app.db import create_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db()
    yield


app = FastAPI(title="Agile Planner", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

# TODO: app.include_router(projects.router) / tasks.router


@app.get("/api/health")
def health():
    return {"ok": True, "model": GEMINI_MODEL, "mock": MOCK_AGENTS}
