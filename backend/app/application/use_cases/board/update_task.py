"""UC-06 · Edit a task: title, description, points, priority and owner (spec 003, US3).
A PATCH can also carry move fields: both are validated first and saved in one commit."""

from collections.abc import Sequence

from app.application.dto import TaskEdit, TaskMove, TaskResult
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.board.common import (
    TaskChangedHandler,
    board_warnings,
    check_target_sprint,
    check_task_change,
    load_task,
    task_view,
)
from app.application.use_cases.board.move_task import MoveTask
from app.domain.board import edit_task
from app.domain.events import EventRef, TaskUpdated


class UpdateTask:
    def __init__(
        self,
        uow: UnitOfWork,
        bus: EventBus,
        move_task: MoveTask,
        after_task_changed: Sequence[TaskChangedHandler] = (),
    ):
        self._uow = uow
        self._bus = bus
        self._move_task = move_task
        self._handlers = list(after_task_changed)

    async def execute(self, task_id: int, edit: TaskEdit, move: TaskMove | None = None) -> TaskResult:
        task, project = load_task(self._uow, task_id)
        values = edit.sent()
        check_task_change(self._uow, project, {**values, **(move.sent() if move else {})})
        if move is not None:
            check_target_sprint(self._uow, task, move.sent())

        saved = self._uow.tasks.save(edit_task(task, values))
        if move is not None:
            saved = self._move_task.apply(project, saved, move)
        self._uow.commit()

        # Published after commit, so nobody hears about a change that wasn't saved.
        event = TaskUpdated(
            project_id=saved.project_id,
            actor="person",
            summary=f"{saved.key} edited ({', '.join(values)})",
            ref=EventRef(kind="task", id=saved.id),  # type: ignore[arg-type]
            task_id=saved.id,  # type: ignore[arg-type]
            fields=list(values),
        )
        await self._bus.publish(event)
        for handler in self._handlers:
            await handler(saved, event)
        if move is not None:
            await self._move_task.notify(saved)
        return TaskResult(task=task_view(self._uow, saved), warnings=board_warnings(project, self._uow.tasks.list_by_project(project.id), saved))  # type: ignore[arg-type]
