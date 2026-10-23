"""UC-06 · Move a card between columns, within a column or between sprints (spec 003, US2 and US4).
Going over a WIP limit or the sprint capacity is saved anyway and returned as a warning."""

from collections.abc import Sequence

from app.application.dto import TaskMove, TaskResult
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.board.common import TaskChangedHandler, board_warnings, check_task_change, load_task, task_view
from app.domain.board import Task, is_continuous, reorder
from app.domain.events import EventRef, TaskStatusChanged
from app.domain.project import Project


class MoveTask:
    def __init__(self, uow: UnitOfWork, bus: EventBus, after_task_changed: Sequence[TaskChangedHandler] = ()):
        self._uow = uow
        self._bus = bus
        self._handlers = list(after_task_changed)

    async def execute(self, task_id: int, move: TaskMove) -> TaskResult:
        task, project = load_task(self._uow, task_id)
        check_task_change(self._uow, project, move.sent())
        moved = self.apply(project, task, move)
        self._uow.commit()
        await self.notify(moved)
        return TaskResult(task=task_view(self._uow, moved), warnings=board_warnings(project, self._uow.tasks.list_by_project(project.id), moved))  # type: ignore[arg-type]

    def apply(self, project: Project, task: Task, move: TaskMove) -> Task:
        """Writes an already validated move without committing (UpdateTask reuses it when a
        PATCH combines edit and move fields). Moving to another sprint without `status` lands
        in "todo" ("backlog" when it goes back to the backlog); without `position`, at the end."""
        sent = move.model_fields_set
        sprint_id = move.sprint_id if "sprint_id" in sent else task.sprint_id
        status = move.status if "status" in sent and move.status is not None else task.status
        if "status" not in sent and sprint_id != task.sprint_id:
            status = "todo" if sprint_id is not None else "backlog"
        same_column = (status, sprint_id) == (task.status, task.sprint_id)
        position = move.position if "position" in sent else task.position if same_column else None

        tasks = self._uow.tasks.list_by_project(project.id)  # type: ignore[arg-type]
        for changed in reorder(tasks, task.id, status, position, sprint_id, continuous=is_continuous(project)):  # type: ignore[arg-type]
            self._uow.tasks.save(changed)
        return self._uow.tasks.get(task.id)  # type: ignore[arg-type, return-value]

    async def notify(self, task: Task) -> None:
        """Published after commit, so nobody hears about a move that wasn't saved."""
        event = TaskStatusChanged(
            project_id=task.project_id,
            actor="person",
            summary=f"{task.key} moved to {task.status}",
            ref=EventRef(kind="task", id=task.id),  # type: ignore[arg-type]
            task_id=task.id,  # type: ignore[arg-type]
            status=task.status,
            sprint_id=task.sprint_id,
            position=task.position,
        )
        await self._bus.publish(event)
        for handler in self._handlers:
            await handler(task, event)
