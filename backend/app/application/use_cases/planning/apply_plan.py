"""UC-05 · The approved plan becomes a board (spec 003, US1).

Runs once the sprints stage is approved (an `on_plan_completed` handler of spec 002), in the
background with its own UnitOfWork. Idempotent: a project that already has a board is left
as it is (planning again is a replan, spec 008)."""

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.board import Objective, build_board
from app.domain.errors import ProjectNotFound, ValidationFailed
from app.domain.events import EventRef, PlanApplied
from app.domain.plan import Backlog, SprintPlanning


class ApplyPlan:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus):
        self._uow_factory = uow_factory
        self._bus = bus

    async def execute(self, project_id: int) -> None:
        with self._uow_factory() as uow:
            project = uow.projects.get(project_id)
            if project is None:
                raise ProjectNotFound(project_id)
            if uow.sprints.list_by_project(project_id) or uow.tasks.list_by_project(project_id):
                return
            plan = project.plan or {}
            if "backlog" not in plan or "sprints" not in plan:
                raise ValidationFailed.single("plan", "The plan has no approved backlog and sprints yet.")

            board = build_board(
                project_id,
                project.members,
                Backlog.model_validate(plan["backlog"]),
                SprintPlanning.model_validate(plan["sprints"]),
            )
            for built in board.sprints:
                sprint = uow.sprints.add(built.sprint)
                uow.objectives.add(Objective(project_id=project_id, sprint_id=sprint.id, title=built.objective_title))  # type: ignore[arg-type]
                for task in built.tasks:
                    uow.tasks.add(task.model_copy(update={"sprint_id": sprint.id}))
            for task in board.backlog:
                uow.tasks.add(task)
            uow.projects.save(project.model_copy(update={"status": "ready"}))
            uow.commit()

        summary = f"The board was built: {len(board.sprints)} sprints, {len(board.tasks)} tasks"
        if board.skipped:
            summary += f" (stories not in the backlog were skipped: {', '.join(board.skipped)})"
        await self._bus.publish(
            PlanApplied(
                project_id=project_id,
                summary=summary,
                ref=EventRef(kind="project", id=project_id),
                sprints=len(board.sprints),
                tasks=len(board.tasks),
                skipped_story_keys=board.skipped,
            )
        )
