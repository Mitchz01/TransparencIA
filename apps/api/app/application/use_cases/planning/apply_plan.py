"""UC-05 · The approved plan becomes a board (spec 003, US1).

Runs once the sprints stage is approved (an `on_plan_completed` handler of spec 002), in the
background with its own UnitOfWork. Idempotent: a project that already has a board is left
as it is (planning again is a replan, spec 008).

Each sprint gets its end date (spec 008): iterations run back to back from the day the plan
is applied, `sprint_length_weeks` each. A continuous (Kanban) board has no end dates.

Follow-ups run after a new board is saved and announced, with the project id: spec 007
registers "propose publishing the tasks as issues" (when a repo is connected)."""

from collections.abc import Awaitable, Callable, Sequence
from datetime import date, datetime, timezone

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.board import Objective, build_board, is_continuous, sprint_end_date, sprint_weeks
from app.domain.errors import ProjectNotFound, ValidationFailed
from app.domain.events import EventRef, PlanApplied
from app.domain.plan import Backlog, SprintPlanning

PlanAppliedFollowUp = Callable[[int], Awaitable[None]]


def _today() -> date:
    return datetime.now(timezone.utc).date()


class ApplyPlan:
    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        bus: EventBus,
        follow_ups: Sequence[PlanAppliedFollowUp] = (),
        today: Callable[[], date] = _today,
    ):
        self._uow_factory = uow_factory
        self._bus = bus
        self._follow_ups = list(follow_ups)
        self._today = today

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
            start, weeks = self._today(), sprint_weeks(project)
            for built in board.sprints:
                end_date = None if is_continuous(project) else sprint_end_date(start, built.sprint.number, weeks)
                sprint = uow.sprints.add(built.sprint.model_copy(update={"end_date": end_date}))
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
        for follow_up in self._follow_ups:
            await follow_up(project_id)
