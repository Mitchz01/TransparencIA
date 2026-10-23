"""UC-03 · Run one planning stage and leave its result as a pending proposal (spec 002, US1).

Runs in the background with its own UnitOfWork. The output is checked twice: by the stage's
schema and by the domain consistency rules (validate_stage_output). An invalid output or an
agent failure is retried once; if the retry fails too, the project ends in `error` and the
leader can resume from this stage (US5). On success, spec 005's AutoApprove decides whether
the proposal is approved right away, which chains to the next stage through AdvancePlanning."""

import logging
import time
from typing import Any

from pydantic import BaseModel

from app.application.ports.agents import PlanningAgents
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.planning.context import build_stage_context
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.errors import ProjectNotFound
from app.domain.events import AgentFinished, AgentStarted, EventRef, PlanFailed, ProposalCreated
from app.domain.plan import PlanningStage, stage_by_key, validate_stage_output
from app.domain.proposals import Proposal

logger = logging.getLogger("agile")

ATTEMPTS = 2  # the first try plus one retry (edge case "wrong format")


class StageFailed(Exception):
    """The stage couldn't produce a valid output after the retry. `message` is safe to show."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class RunPlanningStep:
    def __init__(self, uow_factory: UnitOfWorkFactory, agents: PlanningAgents, bus: EventBus, auto_approve: AutoApprove):
        self._uow_factory = uow_factory
        self._agents = agents
        self._bus = bus
        self._auto_approve = auto_approve

    async def execute(self, project_id: int, stage_key: str, feedback: dict[str, Any] | None = None) -> None:
        stage = stage_by_key(stage_key)
        with self._uow_factory() as uow:
            project = uow.projects.get(project_id)
            if project is None:
                raise ProjectNotFound(project_id)
            proposals = uow.proposals.list_by_project(project_id)
        context = build_stage_context(stage, project, proposals, feedback)

        project_ref = EventRef(kind="project", id=project_id)
        await self._bus.publish(
            AgentStarted(
                project_id=project_id,
                agent=stage.key,
                title=stage.title,
                summary=f"{stage.title} is working on the {stage.key}",
                ref=project_ref,
            )
        )
        try:
            output = await self._run(stage, context)
        except StageFailed as failure:
            await self._fail(project_id, stage, failure.message)
            return

        with self._uow_factory() as uow:
            proposal = uow.proposals.add(
                Proposal(
                    project_id=project_id,
                    kind="plan_stage",
                    key=stage.key,
                    agent=stage.title,
                    content=output,
                    rationale=output.get("rationale", ""),
                )
            )
            uow.commit()
        await self._bus.publish(
            AgentFinished(
                project_id=project_id,
                agent=stage.key,
                title=stage.title,
                output=output,
                summary=f"{stage.title} finished the {stage.key}",
                ref=project_ref,
            )
        )
        await self._bus.publish(
            ProposalCreated(
                project_id=project_id,
                proposal_id=proposal.id,  # type: ignore[arg-type]
                kind=proposal.kind,
                key=proposal.key,
                agent=proposal.agent,
                summary=f"{stage.title} proposed the {stage.key}",
                ref=EventRef(kind="proposal", id=proposal.id),  # type: ignore[arg-type]
            )
        )
        await self._auto_approve.after_created(proposal.id)  # type: ignore[arg-type]

    async def _run(self, stage: PlanningStage, context: dict[str, Any]) -> dict[str, Any]:
        return await run_validated(self._agents, stage, context)

    async def _fail(self, project_id: int, stage: PlanningStage, message: str) -> None:
        with self._uow_factory() as uow:
            project = uow.projects.get(project_id)
            if project is not None:
                uow.projects.save(project.model_copy(update={"status": "error"}))
                uow.commit()
        await self._bus.publish(
            PlanFailed(
                project_id=project_id,
                agent=stage.key,
                error=message,
                summary=f"The {stage.key} stage failed",
                ref=EventRef(kind="project", id=project_id),
            )
        )


async def run_validated(agents: PlanningAgents, stage: PlanningStage, context: dict[str, Any]) -> dict[str, Any]:
    """The stage's validated output as JSON, or StageFailed after ATTEMPTS tries.
    Shared with spec 008's Replan."""
    attempt_context = context
    message = ""
    started = time.monotonic()
    for attempt in range(1, ATTEMPTS + 1):
        try:
            result = await agents.run_stage(stage, attempt_context)
            raw = result.model_dump(mode="json") if isinstance(result, BaseModel) else result
            output = stage.schema.model_validate(raw).model_dump(mode="json")
        except Exception:  # noqa: BLE001  the service failed or the output broke the schema
            logger.warning("Stage %s failed (attempt %d/%d)", stage.key, attempt, ATTEMPTS, exc_info=True)
            message = f"The {stage.title} didn't return a valid result. Retry to run the stage again."
            continue

        issues = validate_stage_output(stage.key, output, context)
        if not issues:
            # SC-001: how long each stage takes against the real model, and how many tries.
            logger.info("Stage %s done in %.1fs (attempt %d)", stage.key, time.monotonic() - started, attempt)
            return output
        logger.warning("Stage %s broke %d rule(s) (attempt %d/%d): %s", stage.key, len(issues), attempt, ATTEMPTS, issues)
        message = f"The {stage.title}'s result broke these rules: " + " ".join(issues)
        attempt_context = {**context, "feedback": _issues_feedback(context, issues, output)}
    raise StageFailed(message)


def _issues_feedback(context: dict[str, Any], issues: list[str], output: dict[str, Any]) -> dict[str, Any]:
    """Feedback for the retry: what broke, plus the leader's reason if the stage was being redone."""
    reason = "Your previous output broke these rules, fix them: " + " ".join(issues)
    previous = context.get("feedback")
    if previous and previous.get("reason"):
        reason = f"{previous['reason']} Also: {reason}"
    return {"reason": reason, "rejected_content": output}
