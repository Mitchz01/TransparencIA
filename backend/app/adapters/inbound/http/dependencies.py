"""Builds the use cases per request with the adapters main.py picked (in app.state)."""

from collections.abc import Iterator

from fastapi import Depends, Request
from sqlmodel import Session

from app.adapters.outbound.persistence.db import get_session
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.application.ports.agents import PlanningAgents
from app.application.ports.code_host import CodeHost
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.planning.run_planning import RunPlanning


def get_uow(session: Session = Depends(get_session)) -> Iterator[UnitOfWork]:
    with SqlUnitOfWork(session) as uow:
        yield uow


def get_agents(request: Request) -> PlanningAgents:
    return request.app.state.agents


def get_code_host(request: Request) -> CodeHost:
    return request.app.state.code_host


def get_event_bus(request: Request) -> EventBus:
    return request.app.state.event_bus


def get_run_planning(agents: PlanningAgents = Depends(get_agents)) -> RunPlanning:
    return RunPlanning(agents)
