"""UC-02 · Edit the project and its team (spec 001, US3 and US4)."""

from collections.abc import Awaitable, Callable, Sequence

from app.application.dto import ProjectUpdate
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound
from app.domain.events import EventRef, MemberChangeInfo, TeamChanged
from app.domain.project import Project, TeamDiff, apply_update

# Spec 008 registers its drift-replan handler here (contract 001 → 008).
TeamChangedHandler = Callable[[TeamChanged], Awaitable[None]]


def _summary(diff: TeamDiff) -> str:
    parts = [f"{name} joined" for name in diff.joined]
    parts += [f"{name} left" for name in diff.left]
    parts += [f"{c.name} changed ({', '.join(c.fields)})" for c in diff.changed]
    return "Team changed: " + "; ".join(parts)


class UpdateProject:
    def __init__(self, uow: UnitOfWork, bus: EventBus, on_team_changed: Sequence[TeamChangedHandler] = ()):
        self._uow = uow
        self._bus = bus
        self._handlers = list(on_team_changed)

    async def execute(self, project_id: int, data: ProjectUpdate) -> Project:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)

        edited, diff = apply_update(project, data.to_changes())

        # Pending tasks of removed members become unassigned; done ones keep who did them.
        if diff.left_ids:
            for task in self._uow.tasks.list_by_project(project_id):
                if task.assignee_id in diff.left_ids and task.status != "done":
                    self._uow.tasks.save(task.model_copy(update={"assignee_id": None}))

        saved = self._uow.projects.save(edited)
        self._uow.commit()

        # Published after commit, so nobody hears about a change that wasn't saved.
        if not diff.empty:
            event = TeamChanged(
                project_id=project_id,
                summary=_summary(diff),
                ref=EventRef(kind="project", id=project_id),
                joined=diff.joined,
                left=diff.left,
                changed=[MemberChangeInfo(member_id=c.member_id, name=c.name, fields=c.fields) for c in diff.changed],
            )
            await self._bus.publish(event)
            for handler in self._handlers:
                await handler(event)
        return saved
