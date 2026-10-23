"""Shared by the board use cases: loading a task, validating a change and the warnings
returned next to the saved task."""

from collections.abc import Awaitable, Callable
from typing import Any

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.board import (
    BoardWarning,
    OverloadWarning,
    Task,
    is_continuous,
    sprint_capacity,
    sprint_load,
    task_change_errors,
    wip_limits,
    wip_warnings,
)
from app.domain.errors import ProjectNotFound, TaskNotFound, ValidationFailed
from app.domain.events import DomainEvent
from app.domain.project import Project

# Called after a task change is saved and published, with the saved task and the event:
# spec 007 registers issue sync, spec 008 objective evaluation (app.state.after_task_changed).
TaskChangedHandler = Callable[[Task, DomainEvent], Awaitable[None]]


def load_task(uow: UnitOfWork, task_id: int) -> tuple[Task, Project]:
    task = uow.tasks.get(task_id)
    if task is None:
        raise TaskNotFound(task_id)
    project = uow.projects.get(task.project_id)
    if project is None:
        raise ProjectNotFound(task.project_id)
    return task, project


def check_task_change(uow: UnitOfWork, project: Project, values: dict[str, Any]) -> None:
    """Raises ValidationFailed with every failing field; nothing has been written yet."""
    sprint_ids = {s.id for s in uow.sprints.list_by_project(project.id) if s.id is not None}  # type: ignore[arg-type]
    member_ids = {m.id for m in project.members if m.id is not None}
    errors = task_change_errors(values, sprint_ids, member_ids)
    if errors:
        raise ValidationFailed(errors, "The task has invalid fields.")


def board_warnings(project: Project, tasks: list[Task], task: Task) -> list[BoardWarning]:
    """WIP warning for the task's column and overload warning for its sprint. Never block."""
    continuous = is_continuous(project)
    same_board = [t for t in tasks if continuous or t.sprint_id == task.sprint_id]
    warnings: list[BoardWarning] = [w for w in wip_warnings(same_board, wip_limits(project)) if w.column == task.status]
    if not continuous and task.sprint_id is not None:
        load = sprint_load(task.sprint_id, tasks, sprint_capacity(project))
        if load.overloaded:
            warnings.append(OverloadWarning(sprint_id=task.sprint_id, points=load.points, capacity=load.capacity))
    return warnings
