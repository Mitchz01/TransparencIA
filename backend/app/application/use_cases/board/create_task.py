"""UC-06 · Add a task to the board, in a column of a sprint, the backlog or a continuous board
(spec 014). It goes to the end of its column with the next "US-N" key."""

from collections.abc import Sequence

from app.application.dto import TaskCreate, TaskResult
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.board.common import TaskChangedHandler, board_warnings, task_view
from app.domain.board import Task, edit_task, is_continuous, new_task_errors, next_task_key
from app.domain.errors import ProjectNotFound, SprintClosed, ValidationFailed
from app.domain.events import EventRef, TaskCreated


class CreateTask:
    def __init__(self, uow: UnitOfWork, bus: EventBus, after_task_changed: Sequence[TaskChangedHandler] = ()):
        self._uow = uow
        self._bus = bus
        self._handlers = list(after_task_changed)

    async def execute(self, project_id: int, request: TaskCreate) -> TaskResult:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        values = request.sent()
        sprints = {s.id: s for s in self._uow.sprints.list_by_project(project_id) if s.id is not None}
        member_ids = {m.id for m in project.members if m.id is not None}
        errors = new_task_errors(values, set(sprints), member_ids)  # type: ignore[arg-type]
        if errors:
            raise ValidationFailed(errors, "The task has invalid fields.")
        sprint_id = values.pop("sprint_id", None)
        if sprint_id is not None and sprints[sprint_id].closed:
            raise SprintClosed(sprint_id)

        continuous = is_continuous(project)
        status = values.pop("status", None) or ("todo" if sprint_id is not None or continuous else "backlog")
        tasks = self._uow.tasks.list_by_project(project_id)
        column = [t for t in tasks if t.status == status and (continuous or t.sprint_id == sprint_id)]
        task = Task(project_id=project_id, sprint_id=sprint_id, key=next_task_key(tasks), title="", status=status, position=len(column))
        saved = self._uow.tasks.add(edit_task(task, {k: v for k, v in values.items() if v is not None}))
        self._uow.commit()

        # Published after commit, so nobody hears about a task that wasn't saved.
        event = TaskCreated(
            project_id=project_id,
            summary=f"{saved.key} created",
            ref=EventRef(kind="task", id=saved.id),  # type: ignore[arg-type]
            task_id=saved.id,  # type: ignore[arg-type]
            key=saved.key,
            status=saved.status,
            sprint_id=saved.sprint_id,
        )
        await self._bus.publish(event)
        for handler in self._handlers:
            await handler(saved, event)
        return TaskResult(task=task_view(self._uow, saved), warnings=board_warnings(project, self._uow.tasks.list_by_project(project_id), saved))
