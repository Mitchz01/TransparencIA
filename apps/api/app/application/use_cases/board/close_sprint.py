"""Close a sprint (spec 008, US4). A closed sprint takes no more tasks (409 sprint_closed on
PATCH /tasks/{id}, spec 003). Its unfinished tasks stay where they are: if there are any,
the `on_sprint_closed` handlers propose a replan (ProposeReplanOnDrift, never auto-approved)."""

from collections.abc import Awaitable, Callable, Sequence

from app.application.dto import SprintCloseResult
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.board import pending_tasks
from app.domain.errors import SprintAlreadyClosed, SprintNotFound
from app.domain.events import EventRef, SprintClosed

SprintClosedHandler = Callable[[SprintClosed], Awaitable[None]]


class CloseSprint:
    def __init__(self, uow: UnitOfWork, bus: EventBus, on_sprint_closed: Sequence[SprintClosedHandler] = ()):
        self._uow = uow
        self._bus = bus
        self._handlers = list(on_sprint_closed)

    async def execute(self, sprint_id: int) -> SprintCloseResult:
        sprint = self._uow.sprints.get(sprint_id)
        if sprint is None:
            raise SprintNotFound(sprint_id)
        if sprint.closed:
            raise SprintAlreadyClosed(sprint_id)
        pending = [t.key for t in pending_tasks(sprint_id, self._uow.tasks.list_by_project(sprint.project_id))]
        saved = self._uow.sprints.save(sprint.model_copy(update={"closed": True}))
        self._uow.commit()

        summary = f"{saved.name} was closed"
        summary += f" with {len(pending)} unfinished task(s): {', '.join(pending)}" if pending else " with every task done"
        event = SprintClosed(
            project_id=saved.project_id,
            summary=summary,
            ref=EventRef(kind="sprint", id=sprint_id),
            sprint_id=sprint_id,
            pending_task_keys=pending,
        )
        await self._bus.publish(event)
        for handler in self._handlers:
            await handler(event)
        return SprintCloseResult(sprint=saved, pending_task_keys=pending, replan_proposed=bool(pending and self._handlers))
