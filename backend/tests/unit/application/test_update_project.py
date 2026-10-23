import asyncio

import pytest

from app.application.dto import MemberUpsert, ProjectUpdate
from app.application.use_cases.projects.update_project import UpdateProject
from app.domain.board import Task
from app.domain.errors import MethodologyLocked, ProjectNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project


def _setup(**overrides):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(**overrides))
    uow.commit()
    return uow, saved


def _run(use_case: UpdateProject, project_id: int, body: ProjectUpdate):
    return asyncio.run(use_case.execute(project_id, body))


def test_partial_change_publishes_nothing():
    uow, saved = _setup()
    bus = RecordingEventBus()
    result = _run(UpdateProject(uow, bus), saved.id, ProjectUpdate(auto_approve=True))
    assert result.auto_approve and result.members == saved.members
    assert bus.events == []


def test_one_event_for_join_leave_and_edit():
    uow, saved = _setup()
    ana, leo = saved.members
    bus = RecordingEventBus()
    received = []

    async def handler(event):
        received.append(event)

    body = ProjectUpdate(members=[MemberUpsert(id=ana.id, hours_per_week=25), MemberUpsert(name="Sofía Paz", role="QA")])
    result = _run(UpdateProject(uow, bus, [handler]), saved.id, body)

    assert [m.name for m in result.members] == ["Ana Gómez", "Sofía Paz"]
    [event] = bus.events
    assert event.type == "team_changed" and event.joined == ["Sofía Paz"] and event.left == ["Leo Ruiz"]
    assert [(c.member_id, c.fields) for c in event.changed] == [(ana.id, ["hours_per_week"])]
    assert "Sofía Paz joined" in event.summary
    assert [e.type for e in received] == ["team_changed"]


def test_removed_member_pending_tasks_are_unassigned():
    uow, saved = _setup()
    leo = saved.members[1]
    pending = uow.tasks.add(Task(project_id=saved.id, key="US-1", title="Login", assignee_id=leo.id, status="in_progress"))
    done = uow.tasks.add(Task(project_id=saved.id, key="US-2", title="Signup", assignee_id=leo.id, status="done"))
    uow.commit()

    _run(UpdateProject(uow, RecordingEventBus()), saved.id, ProjectUpdate(members=[MemberUpsert(id=saved.members[0].id)]))

    assert uow.tasks.get(pending.id).assignee_id is None
    assert uow.tasks.get(done.id).assignee_id == leo.id


def test_invalid_edit_changes_nothing():
    uow, saved = _setup()
    bus = RecordingEventBus()
    with pytest.raises(ValidationFailed):
        _run(UpdateProject(uow, bus), saved.id, ProjectUpdate(members=[]))
    assert uow.projects.get(saved.id) == saved and bus.events == []


def test_methodology_locked_and_unknown_project():
    uow, saved = _setup(status="planning")
    with pytest.raises(MethodologyLocked):
        _run(UpdateProject(uow, RecordingEventBus()), saved.id, ProjectUpdate(requested_methodology="xp"))
    with pytest.raises(ProjectNotFound):
        _run(UpdateProject(uow, RecordingEventBus()), 99, ProjectUpdate(name="X"))


def test_editing_while_planning_is_allowed():
    uow, saved = _setup(status="planning")
    result = _run(UpdateProject(uow, RecordingEventBus()), saved.id, ProjectUpdate(members=[MemberUpsert(id=saved.members[0].id)]))
    assert len(result.members) == 1
