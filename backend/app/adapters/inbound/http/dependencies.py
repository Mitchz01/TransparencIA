"""Builds the use cases per request with the adapters main.py picked (in app.state)."""

from collections.abc import Iterator

from fastapi import Depends, Request
from sqlmodel import Session

from app.adapters.outbound.persistence.db import engine, get_session
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHost
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.application.use_cases.planning.run_planning import RunPlanning
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.application.use_cases.projects.update_project import UpdateProject


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
