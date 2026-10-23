"""UC-06 · Replace a task's checklist: check, uncheck, add, edit and remove steps (spec 003, US3).
A complete checklist on a task in progress suggests moving it forward; it never moves it."""

from collections.abc import Sequence

from app.application.dto import TaskResult
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.board.common import TaskChangedHandler, load_task, task_view
from app.domain.board import ChecklistItem, checklist_errors, suggest_advance
from app.domain.errors import ValidationFailed
from app.domain.events import EventRef, TaskUpdated


class UpdateChecklist:
    def __init__(self, uow: UnitOfWork, bus: EventBus, after_task_changed: Sequence[TaskChangedHandler] = ()):
        self._uow = uow
        self._bus = bus
        self._handlers = list(after_task_changed)

    async def execute(self, task_id: int, items: list[ChecklistItem]) -> TaskResult:
        task, _ = load_task(self._uow, task_id)
        errors = checklist_errors(items)
        if errors:
            raise ValidationFailed(errors, "The checklist has invalid items.")

        checklist = [ChecklistItem(text=i.text.strip(), done=i.done) for i in items]
        saved = self._uow.tasks.save(task.model_copy(update={"checklist": checklist}))
        self._uow.commit()

        done = sum(i.done for i in checklist)
        event = TaskUpdated(
            project_id=saved.project_id,
            actor="person",
            summary=f"{saved.key} checklist: {done}/{len(checklist)} done",
            ref=EventRef(kind="task", id=saved.id),  # type: ignore[arg-type]
            task_id=saved.id,  # type: ignore[arg-type]
            fields=["checklist"],
        )
        await self._bus.publish(event)
        for handler in self._handlers:
            await handler(saved, event)
        return TaskResult(task=task_view(self._uow, saved), suggest_advance=suggest_advance(saved))
