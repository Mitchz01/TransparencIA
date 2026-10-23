"""What happens after a stage proposal is decided (spec 002, US1 and US4).

It's the `plan_stage` applier in spec 005's registry, so it runs for every resolution:
- approved or adjusted: the final content goes to `project.plan[stage]` and the next stage
  runs; after `sprints`, PlanCompleted is published and the on_plan_completed handlers run
  (spec 003's ApplyPlan builds the board and sets the project `ready`; spec 006 adds its own).
- rejected: the same stage runs again with the reason as feedback, until it's been rejected
  MAX_CONSECUTIVE_REJECTIONS times in a row; then it waits for the leader (StageNeedsLeader).

Only acts while the project is `planning`: a stale decision on a finished plan changes nothing."""

import logging
from collections.abc import Awaitable, Callable, Sequence

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.planning.context import rejection_feedback, stage_history
from app.application.use_cases.planning.run_planning_step import RunPlanningStep
from app.domain.events import EventRef, PlanCompleted, StageNeedsLeader
from app.domain.plan import PlanningStage, next_stage, stage_by_key
from app.domain.proposals import MAX_CONSECUTIVE_REJECTIONS, Proposal, consecutive_rejections

logger = logging.getLogger("agile")

# Takes the project id and opens its own UnitOfWork, like ApplyPlan.execute.
PlanCompletedHandler = Callable[[int], Awaitable[None]]


class AdvancePlanning:
    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        bus: EventBus,
        run_step: RunPlanningStep,
        on_plan_completed: Sequence[PlanCompletedHandler] = (),
    ):
        self._uow_factory = uow_factory
        self._bus = bus
        self._run_step = run_step
        # Kept by reference: the composition root can register more handlers later (spec 006).
        self._on_plan_completed = on_plan_completed

    async def on_proposal_resolved(self, proposal_id: int) -> None:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            if proposal is None or proposal.kind != "plan_stage":
                return
            project = uow.projects.get(proposal.project_id)
            if project is None or project.status != "planning":
                logger.info("Proposal %s resolved outside planning: nothing to advance", proposal_id)
                return
            stage = stage_by_key(proposal.key)
            if proposal.decided:
                plan = {**(project.plan or {}), stage.key: proposal.final_content}
                uow.projects.save(project.model_copy(update={"plan": plan}))
                uow.commit()
            history = stage_history(uow.proposals.list_by_project(proposal.project_id), stage.key)

        if proposal.decided:
            await self._advance(proposal.project_id, stage)
        elif proposal.status == "rejected":
            await self._redo(proposal, stage, history)

    async def _advance(self, project_id: int, stage: PlanningStage) -> None:
        following = next_stage(stage.key)
        if following is not None:
            await self._run_step.execute(project_id, following.key)
            return
        await self._bus.publish(
            PlanCompleted(
                project_id=project_id,
                summary="The plan is complete: every stage is approved",
                ref=EventRef(kind="project", id=project_id),
            )
        )
        for handler in self._on_plan_completed:
            await handler(project_id)

    async def _redo(self, proposal: Proposal, stage: PlanningStage, history: list[Proposal]) -> None:
        # Spec 005's rule, so both specs agree on when a stage is capped.
        rejections = consecutive_rejections(history)
        if rejections >= MAX_CONSECUTIVE_REJECTIONS:
            await self._bus.publish(
                StageNeedsLeader(
                    project_id=proposal.project_id,
                    stage=stage.key,
                    rejections=rejections,
                    summary=f"The {stage.key} was rejected {rejections} times in a row: it needs you",
                    ref=EventRef(kind="proposal", id=proposal.id),  # type: ignore[arg-type]
                )
            )
            return
        await self._run_step.execute(proposal.project_id, stage.key, rejection_feedback(proposal))
