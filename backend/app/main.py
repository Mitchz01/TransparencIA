"""Raíz de composición: arma los adaptadores y los conecta con la app.

Es el único módulo que conoce todas las capas. Domain y application no
importan nada de acá ni de adapters.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.inbound.http import health
from app.adapters.outbound.persistence.database import create_db
from app.application.ports import PlanGenerator
from app.config import CORS_ORIGINS, GEMINI_MODEL, MOCK_AGENTS


def build_plan_generator() -> PlanGenerator:
    # Sin credenciales caemos al mock para que el front pueda trabajar igual.
    if MOCK_AGENTS:
        from app.adapters.outbound.planner.mock import MockPlanGenerator

        return MockPlanGenerator()
    from app.adapters.outbound.planner.adk import AdkPlanGenerator

    return AdkPlanGenerator(model=GEMINI_MODEL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    app.state.plan_generator = build_plan_generator()
    yield


app = FastAPI(title="Agile Planner", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

app.include_router(health.router)
# TODO: routers de proyectos y tareas en adapters/inbound/http (specs 001-003)
