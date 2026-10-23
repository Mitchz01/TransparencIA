"""Builds the use cases per request with the adapters main.py picked (in app.state)."""

from collections.abc import Iterator
from datetime import date, datetime, timezone

from fastapi import Depends, Request
from sqlmodel import Session

from app.adapters.inbound.http.background import spawn
from app.adapters.outbound.persistence.db import engine, get_session
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.config import GITHUB_WEBHOOK_SECRET, GITHUB_WEBHOOK_URL, PUBLIC_BASE_URL
from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHost, CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.application.use_cases.board.common import TaskChangedHandler
from app.application.use_cases.board.get_board import GetBoard
from app.application.use_cases.board.move_task import MoveTask
from app.application.use_cases.board.set_capacity import SetCapacity
from app.application.use_cases.board.update_checklist import UpdateChecklist
from app.application.use_cases.board.update_task import UpdateTask
from app.application.use_cases.planning.apply_plan import ApplyPlan
from app.application.use_cases.planning.run_planning import RunPlanning
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_plan_views import GetPlanViews
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.application.use_cases.projects.update_project import UpdateProject
from app.application.use_cases.activity.list_activity import FollowActivity, ListActivity
from app.application.use_cases.integrations.close_discarded_issue import CloseDiscardedIssue
from app.application.use_cases.integrations.connect_repository import ConnectRepository
from app.application.use_cases.integrations.disconnect_repository import DisconnectRepository
from app.application.use_cases.integrations.propose_issues import AfterCreated, ProposeIssues, ProposePendingIssues
from app.application.use_cases.integrations.propose_review import ProposeReview
from app.application.use_cases.integrations.set_github_username import SetGithubUsername
from app.application.use_cases.integrations.sync_task_issue import SyncTaskIssue
from app.application.use_cases.proposals.apply_proposal import ApplyProposal, ProposalAppliers, RetryApply
from app.application.use_cases.proposals.approve_many import ApproveProposals
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.application.use_cases.proposals.list_proposals import GetProposal, ListProposals
from app.application.use_cases.proposals.resolve_proposal import (
    AdjustProposal,
    ApproveProposal,
    RejectProposal,
)


def get_uow(session: Session = Depends(get_session)) -> Iterator[UnitOfWork]:
    with SqlUnitOfWork(session) as uow:
        yield uow


def open_uow() -> UnitOfWork:
    """A UnitOfWork with its own session, for background tasks (never the request's)."""
    return SqlUnitOfWork(Session(engine), owns_session=True)


def get_uow_factory(request: Request) -> UnitOfWorkFactory:
    return request.app.state.uow_factory


def get_agents(request: Request) -> PlanningAgents:
    return request.app.state.agents


def get_code_host(request: Request) -> CodeHost:
    return request.app.state.code_host


def get_code_host_factory(request: Request) -> CodeHostFactory:
    """Spec 007: the code host for a project's token (main.build_code_host_factory)."""
    return request.app.state.code_host_factory


def get_event_bus(request: Request) -> EventBus:
    return request.app.state.event_bus


def get_run_planning(agents: PlanningAgents = Depends(get_agents)) -> RunPlanning:
    return RunPlanning(agents)


# ---------- Projects (spec 001) ----------


def get_create_project(uow: UnitOfWork = Depends(get_uow)) -> CreateProject:
    return CreateProject(uow)


def get_get_project(uow: UnitOfWork = Depends(get_uow)) -> GetProject:
    return GetProject(uow)


def get_list_projects(uow: UnitOfWork = Depends(get_uow)) -> ListProjects:
    return ListProjects(uow)


def get_update_project(
    request: Request, uow: UnitOfWork = Depends(get_uow), bus: EventBus = Depends(get_event_bus)
) -> UpdateProject:
    # Spec 008 adds its drift handler to app.state.on_team_changed in main.py.
    return UpdateProject(uow, bus, getattr(request.app.state, "on_team_changed", ()))


# ---------- Proposals and activity (spec 005) ----------

def get_appliers(request: Request) -> ProposalAppliers:
    return request.app.state.appliers


def get_list_proposals(uow: UnitOfWork = Depends(get_uow)) -> ListProposals:
    return ListProposals(uow)


def get_get_proposal(uow: UnitOfWork = Depends(get_uow)) -> GetProposal:
    return GetProposal(uow)


def get_approve_proposal(uow: UnitOfWork = Depends(get_uow), bus: EventBus = Depends(get_event_bus)) -> ApproveProposal:
    return ApproveProposal(uow, bus)


def get_adjust_proposal(uow: UnitOfWork = Depends(get_uow), bus: EventBus = Depends(get_event_bus)) -> AdjustProposal:
    return AdjustProposal(uow, bus)


def get_reject_proposal(uow: UnitOfWork = Depends(get_uow), bus: EventBus = Depends(get_event_bus)) -> RejectProposal:
    return RejectProposal(uow, bus)


def get_apply_proposal(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory),
    bus: EventBus = Depends(get_event_bus),
    appliers: ProposalAppliers = Depends(get_appliers),
) -> ApplyProposal:
    return ApplyProposal(uow_factory, bus, appliers)


def get_retry_apply(uow_factory: UnitOfWorkFactory = Depends(get_uow_factory)) -> RetryApply:
    return RetryApply(uow_factory)


def get_auto_approve(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory),
    bus: EventBus = Depends(get_event_bus),
    apply: ApplyProposal = Depends(get_apply_proposal),
) -> AutoApprove:
    """For specs 002, 006, 007 and 008: call after_created() after saving a proposal."""
    return AutoApprove(uow_factory, bus, apply)


def get_approve_proposals(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory), bus: EventBus = Depends(get_event_bus)
) -> ApproveProposals:
    return ApproveProposals(uow_factory, bus)


def get_list_activity(uow: UnitOfWork = Depends(get_uow)) -> ListActivity:
    return ListActivity(uow)


def get_follow_activity(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory), bus: EventBus = Depends(get_event_bus)
) -> FollowActivity:
    return FollowActivity(uow_factory, bus)


# ---------- Plan views (spec 004) ----------


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def get_plan_views(uow: UnitOfWork = Depends(get_uow)) -> GetPlanViews:
    return GetPlanViews(uow, today_utc)


# ---------- GitHub integration (spec 007) ----------


def webhook_url() -> str | None:
    """Where GitHub sends the repo's events (spec 008's endpoint); None without a public URL."""
    if GITHUB_WEBHOOK_URL:
        return GITHUB_WEBHOOK_URL
    return f"{PUBLIC_BASE_URL}/webhooks/github" if PUBLIC_BASE_URL else None


def get_auto_approve_in_background(auto_approve: AutoApprove = Depends(get_auto_approve)) -> AfterCreated:
    """AutoApprove.after_created for proposals created in a request: applying runs in the background."""

    async def after_created(proposal_id: int) -> None:
        spawn(auto_approve.after_created(proposal_id))

    return after_created


def get_propose_issues(
    uow: UnitOfWork = Depends(get_uow),
    bus: EventBus = Depends(get_event_bus),
    after_created: AfterCreated = Depends(get_auto_approve_in_background),
) -> ProposeIssues:
    return ProposeIssues(uow, bus, after_created)


def get_connect_repository(
    uow: UnitOfWork = Depends(get_uow),
    bus: EventBus = Depends(get_event_bus),
    code_hosts: CodeHostFactory = Depends(get_code_host_factory),
    propose_issues: ProposeIssues = Depends(get_propose_issues),
) -> ConnectRepository:
    # With a board already built, connecting proposes publishing its tasks (FR-006).
    return ConnectRepository(
        uow, bus, code_hosts, webhook_url(), GITHUB_WEBHOOK_SECRET, [propose_issues.propose_pending]
    )


def get_disconnect_repository(
    uow: UnitOfWork = Depends(get_uow),
    bus: EventBus = Depends(get_event_bus),
    code_hosts: CodeHostFactory = Depends(get_code_host_factory),
) -> DisconnectRepository:
    return DisconnectRepository(uow, bus, code_hosts)


def get_set_github_username(
    uow: UnitOfWork = Depends(get_uow), code_hosts: CodeHostFactory = Depends(get_code_host_factory)
) -> SetGithubUsername:
    return SetGithubUsername(uow, code_hosts)


def get_sync_task_issue(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory),
    bus: EventBus = Depends(get_event_bus),
    code_hosts: CodeHostFactory = Depends(get_code_host_factory),
) -> SyncTaskIssue:
    """Spec 003's board use cases call `.on_task_changed` through app.state.after_task_changed
    (registered in main.py); this is for calling `.execute(task_id)` directly."""
    return SyncTaskIssue(uow_factory, bus, code_hosts)


def get_close_discarded_issue(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory),
    bus: EventBus = Depends(get_event_bus),
    code_hosts: CodeHostFactory = Depends(get_code_host_factory),
) -> CloseDiscardedIssue:
    """For specs 003 (task deleted) and 008 (task discarded in a replan)."""
    return CloseDiscardedIssue(uow_factory, bus, code_hosts)


def get_propose_review(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory),
    bus: EventBus = Depends(get_event_bus),
    agents: PlanningAgents = Depends(get_agents),
    code_hosts: CodeHostFactory = Depends(get_code_host_factory),
    auto_approve: AutoApprove = Depends(get_auto_approve),
) -> ProposeReview:
    """For spec 008's webhook router: run `.execute(...)` on pull_request.opened, in the background
    (it calls the reviewer agent). Auto-approve then applies the review in that same background job."""
    return ProposeReview(uow_factory, bus, agents, code_hosts, auto_approve.after_created)
# ---------- Board (spec 003) ----------


def get_get_board(uow: UnitOfWork = Depends(get_uow)) -> GetBoard:
    return GetBoard(uow)


def get_after_task_changed(request: Request) -> list[TaskChangedHandler]:
    # Spec 007 (issue sync) and spec 008 (objective evaluation) add theirs in main.py.
    return getattr(request.app.state, "after_task_changed", [])


def get_move_task(
    uow: UnitOfWork = Depends(get_uow),
    bus: EventBus = Depends(get_event_bus),
    handlers: list[TaskChangedHandler] = Depends(get_after_task_changed),
) -> MoveTask:
    return MoveTask(uow, bus, handlers)


def get_update_task(
    uow: UnitOfWork = Depends(get_uow),
    bus: EventBus = Depends(get_event_bus),
    move_task: MoveTask = Depends(get_move_task),
    handlers: list[TaskChangedHandler] = Depends(get_after_task_changed),
) -> UpdateTask:
    return UpdateTask(uow, bus, move_task, handlers)


def get_update_checklist(
    uow: UnitOfWork = Depends(get_uow),
    bus: EventBus = Depends(get_event_bus),
    handlers: list[TaskChangedHandler] = Depends(get_after_task_changed),
) -> UpdateChecklist:
    return UpdateChecklist(uow, bus, handlers)


def get_set_capacity(uow: UnitOfWork = Depends(get_uow)) -> SetCapacity:
    return SetCapacity(uow)


# TODO(spec 002): register ApplyPlan as an `on_plan_completed` handler of AdvancePlanning
# (plan 003, T012) once AdvancePlanning exists. It isn't registered in spec 005's ApplierRegistry
# on purpose: a ("plan_stage", "sprints") applier would shadow AdvancePlanning for the last stage,
# and the approved backlog/sprints only reach project.plan through AdvancePlanning.
def get_apply_plan(
    uow_factory: UnitOfWorkFactory = Depends(get_uow_factory),
    bus: EventBus = Depends(get_event_bus),
    auto_approve: AutoApprove = Depends(get_auto_approve),
) -> ApplyPlan:
    # Spec 007 (T019): with a repo connected, the new board's tasks are proposed as issues.
    # ApplyPlan already runs in the background, so auto-approve applies in that same job.
    return ApplyPlan(uow_factory, bus, [ProposePendingIssues(uow_factory, bus, auto_approve.after_created)])
