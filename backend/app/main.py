"""Composition root: the only module that knows every layer and wires ports to adapters."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.inbound.http import activity, board, dev, documents, health, integrations, planning, projects, proposals
from app.adapters.inbound.http.background import spawn
from app.adapters.inbound.http.dependencies import open_uow, wire_documents, wire_planning, wire_replanning
from app.adapters.inbound.http.errors import register_error_handlers
from app.adapters.inbound.webhooks import github as github_webhooks
from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.adapters.outbound.events.in_memory_bus import InMemoryEventBus
from app.adapters.outbound.events.persistent_bus import PersistentEventBus
from app.application.use_cases.board.evaluate_objectives import EvaluateObjectives
from app.application.use_cases.integrations.apply_review import ApplyReview
from app.application.use_cases.planning.apply_replan import ReplanOutcome
from app.application.use_cases.planning.propose_replan_on_drift import ProposeReplanOnDrift
from app.application.use_cases.integrations.prune_sync_records import PruneSyncRecords
from app.application.use_cases.integrations.publish_issues import PublishIssues
from app.application.use_cases.integrations.sync_task_issue import SyncTaskIssue
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry
from app.adapters.outbound.persistence.db import create_db
from app.domain.board import Task
from app.domain.events import DomainEvent, SprintClosed, TeamChanged
from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHost, CodeHostFactory, OnRetry
from app.config import (
    CORS_ORIGINS,
    ENV,
    GEMINI_MODEL,
    GITHUB_TOKEN,
    GITHUB_WEBHOOK_SECRET,
    MOCK_AGENTS,
    MOCK_AGENTS_DELAY,
    MOCK_GITHUB_FORCED,
)


def build_agents() -> PlanningAgents:
    if MOCK_AGENTS:
        from app.adapters.outbound.agents.mock.agents import MockPlanningAgents

        return MockPlanningAgents(delay_seconds=MOCK_AGENTS_DELAY)
    # Deferred import: ADK is heavy and isn't needed in mock mode.
    from app.adapters.outbound.agents.adk.agents import AdkPlanningAgents

    return AdkPlanningAgents(model=GEMINI_MODEL)


def build_code_host_factory(fake: CodeHost) -> CodeHostFactory:
    """Per project (spec 007, FR-004/FR-005): its own token, else the installation's
    GITHUB_TOKEN, else `fake` (test mode). One shared fake keeps the demo's records together."""

    def for_token(project_token: str | None, on_retry: OnRetry | None = None) -> CodeHost:
        token = project_token or GITHUB_TOKEN
        if MOCK_GITHUB_FORCED or not token:
            return fake
        from app.adapters.outbound.code_host.github.code_host import GitHubCodeHost

        return GitHubCodeHost(token, on_retry=on_retry)

    return for_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    PruneSyncRecords(open_uow).execute()  # spec 008: old webhook deliveries and consumed own writes
    app.state.agents = build_agents()
    app.state.code_host_factory = build_code_host_factory(FakeCodeHost())  # spec 007: per project token
    app.state.code_host = app.state.code_host_factory(None)  # the installation's
    app.state.uow_factory = open_uow
    app.state.webhook_secret = GITHUB_WEBHOOK_SECRET  # spec 008: verifies POST /webhooks/github
    # Every event is saved as activity (seq, history, SSE replay) before it's fanned out (spec 005).
    app.state.event_bus = PersistentEventBus(InMemoryEventBus(), open_uow)
    # Steps that apply each kind of proposal, registered by their owner specs (spec 005, "Applying"):
    #   002: "plan_stage" → AdvancePlanning.on_proposal_resolved (registered by wire_planning below)
    #   006: "document" → ApplyDocumentProposal, rejections → GenerateDocuments (registered by wire_documents)
    #   007: "github_action" create_issues/request_review → PublishIssues/ApplyReview
    #   008: "replan" → ApplyReplan
    app.state.appliers = ApplierRegistry()
    # Spec 007: approving a github_action proposal writes to GitHub.
    publish_issues = PublishIssues(open_uow, app.state.event_bus, app.state.code_host_factory)
    app.state.appliers.register("github_action", publish_issues.execute, key="create_issues")
    apply_review = ApplyReview(open_uow, app.state.event_bus, app.state.code_host_factory)
    app.state.appliers.register("github_action", apply_review.execute, key="request_review")
    # Run once every stage is approved (spec 002), in order: 003's ApplyPlan (wire_planning, with 007's
    # ProposePendingIssues as its follow-up), then 006's GenerateDocuments (wire_documents).
    app.state.on_plan_completed = []
    app.state.run_planning_step = wire_planning(
        open_uow, app.state.event_bus, app.state.agents, app.state.appliers, app.state.on_plan_completed
    )
    app.state.generate_documents = wire_documents(
        open_uow, app.state.event_bus, app.state.agents, app.state.appliers, app.state.on_plan_completed
    )
    # Spec 008: on-demand and drift replans; approving one runs ApplyReplan, then these follow-ups
    # (007's issues, 006's MarkDocumentsOutdated, objectives).
    app.state.on_replan_applied = []
    app.state.replan = wire_replanning(
        open_uow,
        app.state.event_bus,
        app.state.agents,
        app.state.appliers,
        app.state.code_host_factory,
        app.state.on_replan_applied,
    )
    # Spec 008 (US4): a team change (spec 001) or a sprint closed with pending work proposes an
    # automatic replan. The agent is slow, so it runs in the background.
    drift = ProposeReplanOnDrift(open_uow, app.state.replan)

    async def replan_on_team_change(event: TeamChanged) -> None:
        spawn(drift.on_team_changed(event))

    async def replan_on_sprint_closed(event: SprintClosed) -> None:
        spawn(drift.on_sprint_closed(event))

    app.state.on_team_changed = [replan_on_team_change]
    app.state.on_sprint_closed = [replan_on_sprint_closed]
    app.state.after_task_changed = []  # spec 007 registers issue sync, spec 008 objective evaluation
    # Spec 007 (FR-021): editing a published task updates its issue, without a proposal.
    # It talks to GitHub, so it runs in the background and never slows down the board edit.
    sync_task_issue = SyncTaskIssue(open_uow, app.state.event_bus, app.state.code_host_factory)

    async def sync_issue_in_background(task: Task, event: DomainEvent) -> None:
        spawn(sync_task_issue.on_task_changed(task, event))

    app.state.after_task_changed.append(sync_issue_in_background)
    # Spec 008 (US3): objectives close (or reopen) after a move, from the board or from GitHub,
    # and after a replan changes the board.
    evaluate_objectives = EvaluateObjectives(open_uow, app.state.event_bus)
    app.state.after_task_changed.append(evaluate_objectives.on_task_changed)

    async def evaluate_after_replan(outcome: ReplanOutcome) -> None:
        await evaluate_objectives.execute(outcome.project_id)

    app.state.on_replan_applied.append(evaluate_after_replan)
    yield


app = FastAPI(title="Agile Planner", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
register_error_handlers(app)

app.include_router(health.router)
app.include_router(projects.router)
app.include_router(planning.router)
app.include_router(proposals.router)
app.include_router(activity.router)
app.include_router(integrations.router)  # spec 007
app.include_router(board.router)
app.include_router(documents.router)  # spec 006
app.include_router(github_webhooks.router)  # spec 008
if ENV == "dev":
    app.include_router(dev.router)  # spec 008 (T029): replay GitHub events without a tunnel
