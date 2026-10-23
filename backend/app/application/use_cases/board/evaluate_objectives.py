"""Objectives that close by themselves (spec 008, US3, FR-007).

An objective is met when every task of its sprint is done, however they got there: it's an
`after_task_changed` handler (moves on the board, spec 003, and GitHub progress, US1) and a
follow-up of ApplyReplan. If a task leaves "done", its objective is in progress again.
Every objective of the project is checked: a move between sprints changes two of them."""

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.board import Objective, Task, objectives_to_close
from app.domain.events import DomainEvent, EventRef, ObjectiveClosed, ObjectiveReopened


class EvaluateObjectives:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus):
        self._uow_factory = uow_factory
        self._bus = bus

    async def execute(self, project_id: int) -> list[Objective]:
        """The objectives that changed (met or reopened)."""
        with self._uow_factory() as uow:
            changed = objectives_to_close(uow.objectives.list_by_project(project_id), uow.tasks.list_by_project(project_id))
            saved = [uow.objectives.save(objective) for objective in changed]
            if saved:
                uow.commit()
        for objective in saved:
            fields = {
                "project_id": project_id,
                "ref": EventRef(kind="project", id=project_id),
                "objective_id": objective.id or 0,
                "sprint_id": objective.sprint_id,
            }
            if objective.done:
                await self._bus.publish(ObjectiveClosed(summary=f"Objective met: {objective.title}", **fields))
            else:
                await self._bus.publish(ObjectiveReopened(summary=f"Objective in progress again: {objective.title}", **fields))
        return saved

    async def on_task_changed(self, task: Task, event: DomainEvent) -> None:
        """`after_task_changed` handler: only status changes can meet or reopen an objective."""
        if event.type == "task_status_changed":
            await self.execute(task.project_id)
