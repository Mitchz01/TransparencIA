import asyncio

import pytest

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.application.dto import TaskMove
from app.application.use_cases.board.get_board import GetBoard
from app.application.use_cases.board.move_task import MoveTask
from app.application.use_cases.planning.apply_plan import ApplyPlan
from app.domain.board import OverloadWarning, WipWarning
from app.domain.errors import TaskNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project

KANBAN = {**MOCK_PLAN, "methodology": {**MOCK_PLAN["methodology"], "methodology": "kanban"}}


def _board(plan=MOCK_PLAN, **overrides):
    """A project with the mock plan applied: sprints 1–3 with US-1…US-11 in "todo"."""
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(plan=plan, **overrides))
    uow.commit()
    asyncio.run(ApplyPlan(uow.factory(), RecordingEventBus()).execute(saved.id))
    uow.rollback()  # see what ApplyPlan committed
    tasks = {t.key: t for t in uow.tasks.list_by_project(saved.id)}
    sprints = uow.sprints.list_by_project(saved.id)
    return uow, saved, tasks, sprints


def _move(uow, task_id, handlers=(), **fields):
    bus = RecordingEventBus()
    result = asyncio.run(MoveTask(uow, bus, handlers).execute(task_id, TaskMove(**fields)))
    return result, bus


def _column(uow, project_id, sprint_id, status):
    tasks = [t for t in uow.tasks.list_by_project(project_id) if t.sprint_id == sprint_id and t.status == status]
    return [t.key for t in sorted(tasks, key=lambda t: t.position)]


def test_status_and_position_are_saved_and_published():
    uow, saved, tasks, sprints = _board()
    received = []

    async def handler(task, event):
        received.append((task.key, event.type))

    result, bus = _move(uow, tasks["US-3"].id, [handler], status="in_progress", position=0)

    assert (result.task.status, result.task.position, result.warnings) == ("in_progress", 0, [])
    assert uow.tasks.get(tasks["US-3"].id).status == "in_progress"
    assert _column(uow, saved.id, sprints[0].id, "todo") == ["US-1", "US-2", "US-4"]  # compacted
    [event] = bus.events
    assert (event.type, event.task_id, event.status, event.actor) == ("task_status_changed", tasks["US-3"].id, "in_progress", "person")
    assert received == [("US-3", "task_status_changed")]


def test_reorder_within_the_column_survives_a_new_unit():
    uow, saved, tasks, sprints = _board()
    _move(uow, tasks["US-3"].id, position=0)
    with uow.factory()() as fresh:
        assert _column(fresh, saved.id, sprints[0].id, "todo") == ["US-3", "US-1", "US-2", "US-4"]


def test_wip_limit_is_a_warning_and_never_blocks():
    uow, saved, tasks, sprints = _board(sprint_capacity_override=100)  # scrumban: in_progress limit 3
    for key in ("US-5", "US-6", "US-7"):
        assert _move(uow, tasks[key].id, status="in_progress")[0].warnings == []
    result, _ = _move(uow, tasks["US-8"].id, status="in_progress")
    assert result.task.status == "in_progress"
    assert result.warnings == [WipWarning(column="in_progress", limit=3, count=4)]


def test_unknown_task_and_invalid_moves_save_nothing():
    uow, saved, tasks, sprints = _board()
    with pytest.raises(TaskNotFound):
        _move(uow, 999, status="done")
    with pytest.raises(ValidationFailed) as error:
        _move(uow, tasks["US-1"].id, position=-1, sprint_id=999)
    assert [e.field for e in error.value.errors] == ["position", "sprint_id"]
    with pytest.raises(ValidationFailed) as error:
        _move(uow, tasks["US-1"].id)
    assert error.value.errors[0].message == "No fields to update."
    assert uow.tasks.get(tasks["US-1"].id) == tasks["US-1"]


# ---------- Between sprints (US4) ----------


def test_moving_to_another_sprint_lands_in_todo_and_updates_both_loads():
    uow, saved, tasks, sprints = _board()
    sprint_1, sprint_2 = sprints[0].id, sprints[1].id
    _move(uow, tasks["US-3"].id, status="review")
    before = {s.id: s.load.points for s in GetBoard(uow).execute(saved.id).sprints}

    result, bus = _move(uow, tasks["US-3"].id, sprint_id=sprint_2)  # 3 points

    assert (result.task.sprint_id, result.task.status) == (sprint_2, "todo")
    assert _column(uow, saved.id, sprint_2, "todo")[-1] == "US-3"
    after = {s.id: s.load.points for s in GetBoard(uow).execute(saved.id).sprints}
    assert (after[sprint_1], after[sprint_2]) == (before[sprint_1] - 3, before[sprint_2] + 3)
    assert bus.events[0].sprint_id == sprint_2


def test_moving_to_the_backlog():
    uow, saved, tasks, sprints = _board()
    result, _ = _move(uow, tasks["US-1"].id, sprint_id=None)
    assert (result.task.sprint_id, result.task.status) == (None, "backlog")


def test_overloaded_sprint_is_a_warning():
    uow, saved, tasks, sprints = _board(sprint_capacity_override=10)
    result, _ = _move(uow, tasks["US-6"].id, sprint_id=sprints[0].id)  # 11 + 8 points > 10
    assert result.task.sprint_id == sprints[0].id
    assert result.warnings == [OverloadWarning(sprint_id=sprints[0].id, points=19, capacity=10)]


def test_continuous_board_has_no_sprint_load_and_one_column_per_status():
    uow, saved, tasks, sprints = _board(KANBAN, sprint_capacity_override=1)
    view = GetBoard(uow).execute(saved.id)
    assert view.continuous and all(s.load is None for s in view.sprints)
    result, _ = _move(uow, tasks["US-10"].id, position=0)  # sprint 3's card to the top of the whole "todo"
    assert result.warnings == []  # no sprint capacity on a continuous board
    todo = sorted((t for t in uow.tasks.list_by_project(saved.id) if t.status == "todo"), key=lambda t: t.position)
    assert [t.position for t in todo] == list(range(11)) and todo[0].key == "US-10"
