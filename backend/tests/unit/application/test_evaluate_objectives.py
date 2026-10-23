"""Spec 008, US3: objectives close by themselves when all their tasks are done."""

import asyncio

from app.application.use_cases.board.evaluate_objectives import EvaluateObjectives
from app.domain.board import Objective, Task, objectives_to_close
from app.domain.events import TaskStatusChanged, TaskUpdated
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run


def _task(sprint_id, status, key="US-1"):
    return Task(project_id=1, sprint_id=sprint_id, key=key, title=key, status=status)


# ---------- objectives_to_close (domain) ----------


def test_met_when_every_task_of_the_sprint_is_done():
    objectives = [Objective(id=1, project_id=1, sprint_id=10, title="A"), Objective(id=2, project_id=1, sprint_id=20, title="B")]
    tasks = [_task(10, "done"), _task(10, "done"), _task(20, "done"), _task(20, "review")]
    [closed] = objectives_to_close(objectives, tasks)
    assert (closed.id, closed.done) == (1, True)


def test_reopened_when_a_task_leaves_done():
    objectives = [Objective(id=1, project_id=1, sprint_id=10, title="A", done=True)]
    [reopened] = objectives_to_close(objectives, [_task(10, "done"), _task(10, "todo")])
    assert reopened.done is False


def test_unchanged_objectives_and_empty_sprints_are_left_alone():
    objectives = [
        Objective(id=1, project_id=1, sprint_id=10, title="A", done=True),
        Objective(id=2, project_id=1, sprint_id=20, title="B"),
        Objective(id=3, project_id=1, sprint_id=30, title="Empty"),
    ]
    assert objectives_to_close(objectives, [_task(10, "done"), _task(20, "todo")]) == []


# ---------- EvaluateObjectives ----------


def _setup():
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project())
    objective = uow.objectives.add(Objective(project_id=saved.id, sprint_id=7, title="Login works"))
    tasks = [
        uow.tasks.add(Task(project_id=saved.id, sprint_id=7, key=f"US-{i}", title="t", status="done" if i < 3 else "review"))
        for i in (1, 2, 3)
    ]
    uow.commit()
    return uow, saved.id, objective, tasks


def _set_status(uow, task, status):
    with uow:
        saved = uow.tasks.save(task.model_copy(update={"status": status}))
        uow.commit()
    return saved


def _moved(task):
    return TaskStatusChanged(project_id=task.project_id, task_id=task.id, status=task.status)


def test_the_last_task_done_closes_the_objective_and_publishes_it():
    uow, pid, objective, tasks = _setup()
    bus = RecordingEventBus()
    use_case = EvaluateObjectives(uow.factory(), bus)

    third = _set_status(uow, tasks[2], "done")
    run(use_case.on_task_changed(third, _moved(third)))

    with uow:
        assert uow.objectives.list_by_project(pid)[0].done is True
    [event] = bus.events
    assert (event.type, event.objective_id, event.sprint_id) == ("objective_closed", objective.id, 7)
    assert event.summary == "Objective met: Login works"

    # Evaluating again changes nothing
    run(use_case.on_task_changed(third, _moved(third)))
    assert len(bus.events) == 1


def test_a_task_leaving_done_reopens_it():
    uow, pid, objective, tasks = _setup()
    bus = RecordingEventBus()
    use_case = EvaluateObjectives(uow.factory(), bus)
    run(use_case.on_task_changed(_set_status(uow, tasks[2], "done"), _moved(tasks[2])))

    reopened = _set_status(uow, tasks[0], "todo")
    run(use_case.on_task_changed(reopened, _moved(reopened)))

    with uow:
        assert uow.objectives.list_by_project(pid)[0].done is False
    assert [e.type for e in bus.events] == ["objective_closed", "objective_reopened"]


def test_edits_that_dont_move_the_task_are_ignored():
    uow, pid, objective, tasks = _setup()
    bus = RecordingEventBus()
    third = _set_status(uow, tasks[2], "done")
    edited = TaskUpdated(project_id=pid, task_id=third.id, fields=["title"])
    run(EvaluateObjectives(uow.factory(), bus).on_task_changed(third, edited))
    assert bus.events == []
