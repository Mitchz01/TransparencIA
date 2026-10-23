"""Spec 014, US1: a person adds a task to a column of the board."""

import asyncio

import pytest

from app.application.dto import TaskCreate
from app.application.use_cases.board.create_task import CreateTask
from app.domain.board import Sprint, Task
from app.domain.errors import ProjectNotFound, SprintClosed, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project


def _setup(**project_fields):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(**project_fields))
    sprint = uow.sprints.add(Sprint(project_id=saved.id, number=1, name="Sprint 1", goal="Base"))
    closed = uow.sprints.add(Sprint(project_id=saved.id, number=0, name="Sprint 0", goal="Old", closed=True))
    for i, status in enumerate(("todo", "todo", "in_progress"), start=1):
        uow.tasks.add(Task(project_id=saved.id, sprint_id=sprint.id, key=f"US-{i}", title="t", status=status, position=i))
    uow.commit()
    return uow, saved, sprint, closed


def _create(uow, project_id, handlers=(), **fields):
    bus = RecordingEventBus()
    return asyncio.run(CreateTask(uow, bus, handlers).execute(project_id, TaskCreate(**fields))), bus


def test_task_lands_at_the_end_of_its_column_with_the_next_key():
    uow, saved, sprint, _ = _setup()
    received = []

    async def handler(task, event):
        received.append((task.key, event.type))

    result, bus = _create(uow, saved.id, handlers=[handler], title="  Fix checkout copy ", sprint_id=sprint.id)

    task = result.task
    assert (task.key, task.title, task.sprint_id, task.status, task.position) == ("A-1", "Fix checkout copy", sprint.id, "todo", 2)
    assert (task.priority, task.points, task.type, task.epic_key, task.checklist, task.assignee_id) == ("medium", 1, "feature", "", [], None)
    assert uow.tasks.get(task.id) is not None
    [event] = bus.events
    assert (event.type, event.task_id, event.key, event.status, event.sprint_id, event.actor) == ("task_created", task.id, "A-1", "todo", sprint.id, "person")
    assert event.summary == "A-1 created"
    assert received == [("A-1", "task_created")]


def test_sent_fields_are_kept():
    uow, saved, sprint, _ = _setup()
    member = saved.members[0]
    result, _ = _create(
        uow, saved.id, title="Spike", sprint_id=sprint.id, status="in_progress", priority="high", points=3, assignee_id=member.id, epic_key="E2", description="Why"
    )
    task = result.task
    assert (task.status, task.position, task.priority, task.points, task.assignee_id, task.epic_key, task.description) == (
        "in_progress", 1, "high", 3, member.id, "E2", "Why",
    )


def test_without_a_sprint_it_goes_to_the_backlog_or_the_continuous_board():
    uow, saved, _, _ = _setup()
    result, _ = _create(uow, saved.id, title="Later")
    assert (result.task.sprint_id, result.task.status) == (None, "backlog")

    uow, kanban, _, _ = _setup(requested_methodology="kanban")
    result, _ = _create(uow, kanban.id, title="Now")
    assert (result.task.sprint_id, result.task.status) == (None, "todo")


def test_invalid_fields_save_nothing():
    uow, saved, _, _ = _setup()
    with pytest.raises(ValidationFailed) as error:
        _create(uow, saved.id, points=200, sprint_id=99)
    assert [e.field for e in error.value.errors] == ["title", "points", "sprint_id"]
    assert len(uow.tasks.list_by_project(saved.id)) == 3


def test_closed_sprint_and_unknown_project():
    uow, saved, _, closed = _setup()
    with pytest.raises(SprintClosed):
        _create(uow, saved.id, title="Late", sprint_id=closed.id)
    with pytest.raises(ProjectNotFound):
        _create(uow, 999, title="Nowhere")


def test_going_over_the_capacity_is_a_warning():
    uow, saved, sprint, _ = _setup(sprint_capacity_override=4)
    result, _ = _create(uow, saved.id, title="Big", sprint_id=sprint.id, points=8)
    assert [w.code for w in result.warnings] == ["sprint_overloaded"]
