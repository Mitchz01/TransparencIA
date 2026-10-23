import asyncio

import pytest

from app.application.dto import TaskEdit, TaskMove
from app.application.use_cases.board.move_task import MoveTask
from app.application.use_cases.board.update_checklist import UpdateChecklist
from app.application.use_cases.board.update_task import UpdateTask
from app.domain.board import ChecklistItem, Sprint, Task
from app.domain.errors import TaskNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project


def _setup(**task_fields):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project())
    sprint = uow.sprints.add(Sprint(project_id=saved.id, number=1, name="Sprint 1", goal="Base"))
    fields = {"project_id": saved.id, "sprint_id": sprint.id, "key": "US-1", "title": "Login", "status": "todo", **task_fields}
    task = uow.tasks.add(Task(**fields))
    uow.commit()
    return uow, saved, task


def _edit(uow, task_id, move=None, handlers=(), **fields):
    bus = RecordingEventBus()
    use_case = UpdateTask(uow, bus, MoveTask(uow, bus, handlers), handlers)
    return asyncio.run(use_case.execute(task_id, TaskEdit(**fields), move)), bus


def _checklist(uow, task_id, items, handlers=()):
    bus = RecordingEventBus()
    return asyncio.run(UpdateChecklist(uow, bus, handlers).execute(task_id, items)), bus


# ---------- UpdateTask ----------


def test_edit_fields_are_saved_and_published():
    uow, saved, task = _setup(priority="medium")
    received = []

    async def handler(task, event):
        received.append(event.type)

    result, bus = _edit(uow, task.id, handlers=[handler], priority="high", title="  Sign in ", points=5, description="New")

    assert (result.task.priority, result.task.title, result.task.points, result.task.description) == ("high", "Sign in", 5, "New")
    assert uow.tasks.get(task.id).priority == "high"
    [event] = bus.events
    assert (event.type, event.task_id, event.actor) == ("task_updated", task.id, "person")
    assert sorted(event.fields) == ["description", "points", "priority", "title"]
    assert received == ["task_updated"]


def test_assigning_clears_the_missing_role():
    uow, saved, task = _setup(missing_role="UX Design")
    result, _ = _edit(uow, task.id, assignee_id=saved.members[1].id)
    assert (result.task.assignee_id, result.task.missing_role) == (saved.members[1].id, None)
    # Unassigning keeps the task unassigned, without inventing a missing role
    result, _ = _edit(uow, task.id, assignee_id=None)
    assert (result.task.assignee_id, result.task.missing_role) == (None, None)


def test_edit_and_move_together_are_saved_in_one_commit():
    uow, saved, task = _setup()
    commits = uow.commits
    result, bus = _edit(uow, task.id, move=TaskMove(status="in_progress"), priority="low")
    assert (result.task.priority, result.task.status) == ("low", "in_progress")
    assert uow.commits == commits + 1
    assert [e.type for e in bus.events] == ["task_updated", "task_status_changed"]


def test_invalid_edit_saves_nothing():
    uow, saved, task = _setup()
    with pytest.raises(ValidationFailed) as error:
        _edit(uow, task.id, move=TaskMove(position=-1), title="", points=500, assignee_id=999)
    assert [e.field for e in error.value.errors] == ["position", "points", "title", "assignee_id"]
    assert uow.tasks.get(task.id) == task
    with pytest.raises(TaskNotFound):
        _edit(uow, 999, title="x")


# ---------- UpdateChecklist ----------


def test_check_add_and_remove_steps():
    items = [ChecklistItem(text=t) for t in ("Form", "Validation", "Tests", "Docs")]
    uow, saved, task = _setup(checklist=items)

    result, bus = _checklist(uow, task.id, [ChecklistItem(text="Form", done=True), *items[1:3], ChecklistItem(text=" New step ")])

    assert [(i.text, i.done) for i in result.task.checklist] == [("Form", True), ("Validation", False), ("Tests", False), ("New step", False)]
    assert uow.tasks.get(task.id).checklist == result.task.checklist
    assert result.suggest_advance is False and result.warnings == []
    [event] = bus.events
    assert (event.type, event.fields, event.summary) == ("task_updated", ["checklist"], "US-1 checklist: 1/4 done")


def test_complete_checklist_suggests_advancing_but_does_not_move():
    uow, saved, task = _setup(status="in_progress", checklist=[ChecklistItem(text="A", done=True), ChecklistItem(text="B")])
    result, _ = _checklist(uow, task.id, [ChecklistItem(text="A", done=True), ChecklistItem(text="B", done=True)])
    assert result.suggest_advance is True
    assert uow.tasks.get(task.id).status == "in_progress"


def test_complete_checklist_outside_in_progress_suggests_nothing():
    uow, saved, task = _setup(status="todo")
    result, _ = _checklist(uow, task.id, [ChecklistItem(text="A", done=True)])
    assert result.suggest_advance is False


def test_invalid_checklist_saves_nothing():
    uow, saved, task = _setup(checklist=[ChecklistItem(text="A")])
    with pytest.raises(ValidationFailed) as error:
        _checklist(uow, task.id, [ChecklistItem(text="ok"), ChecklistItem(text=" "), ChecklistItem(text="x" * 301)])
    assert [e.field for e in error.value.errors] == ["items[1].text", "items[2].text"]
    with pytest.raises(ValidationFailed) as error:
        _checklist(uow, task.id, [ChecklistItem(text=f"step {i}") for i in range(51)])
    assert [e.field for e in error.value.errors] == ["items"]
    assert uow.tasks.get(task.id).checklist == [ChecklistItem(text="A")]
    with pytest.raises(TaskNotFound):
        _checklist(uow, 999, [])
