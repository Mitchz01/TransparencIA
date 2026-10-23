"""Composition root: the only module that knows every layer and wires ports to adapters."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.inbound.http import activity, health, projects, proposals
from app.adapters.inbound.http.dependencies import open_uow
from app.adapters.inbound.http.errors import register_error_handlers
from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.adapters.outbound.events.in_memory_bus import InMemoryEventBus
from app.adapters.outbound.events.persistent_bus import PersistentEventBus
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry
from app.adapters.outbound.persistence.db import create_db
from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHost
from app.config import CORS_ORIGINS, GEMINI_MODEL, MOCK_AGENTS, MOCK_GITHUB, logger


def build_agents() -> PlanningAgents:
    if MOCK_AGENTS:
        from app.adapters.outbound.agents.mock.agents import MockPlanningAgents

        return MockPlanningAgents()
    # Deferred import: ADK is heavy and isn't needed in mock mode.
    from app.adapters.outbound.agents.adk.agents import AdkPlanningAgents

    return AdkPlanningAgents(model=GEMINI_MODEL)


def build_code_host() -> CodeHost:
    if not MOCK_GITHUB:
        # TODO(spec 007): return GitHubCodeHost(token=GITHUB_TOKEN)
        logger.warning("GitHubCodeHost doesn't exist yet (spec 007): using FakeCodeHost")
    return FakeCodeHost()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    app.state.agents = build_agents()
    app.state.code_host = build_code_host()
    app.state.uow_factory = open_uow
    # Every event is saved as activity (seq, history, SSE replay) before it's fanned out (spec 005).
    app.state.event_bus = PersistentEventBus(InMemoryEventBus(), open_uow)
    # Steps that apply each kind of proposal, registered by their owner specs (spec 005, "Applying"):
    #   002: appliers.register("plan_stage", advance_planning.on_proposal_resolved, on=("decided", "rejected"))
    #   006: "document" → ApplyDocumentProposal · 007: "github_action" create_issues/request_review → PublishIssues/ApplyReview
    #   008: "replan" → ApplyReplan
    app.state.appliers = ApplierRegistry()
    app.state.on_team_changed = []  # spec 008 registers its drift-replan handler here
    yield


app = FastAPI(title="Agile Planner", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
register_error_handlers(app)

app.include_router(health.router)
app.include_router(projects.router)
app.include_router(proposals.router)
app.include_router(activity.router)
# TODO: projects, planning, proposals, board, documents (adapters/inbound/http) and webhooks/github
