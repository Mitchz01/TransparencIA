"""Builds the use cases per request with the adapters main.py picked (in app.state)."""

from collections.abc import Iterator
from datetime import date, datetime, timezone

from fastapi import Depends, Request
from sqlmodel import Session

from app.adapters.outbound.persistence.db import engine, get_session
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHost, CodeHostFactory
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.application.use_cases.planning.run_planning import RunPlanning
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_plan_views import GetPlanViews
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.application.use_cases.projects.update_project import UpdateProject
from app.application.use_cases.activity.list_activity import FollowActivity, ListActivity
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
