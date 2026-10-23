"""The planning pipeline wired like dependencies.wire_planning, on the in-memory fakes,
with agents that can be scripted per stage (never Gemini)."""

from dataclasses import dataclass, field
from typing import Any

from app.adapters.outbound.agents.mock.agents import MockPlanningAgents
from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.application.use_cases.planning.advance_planning import AdvancePlanning
from app.application.use_cases.planning.run_planning_step import RunPlanningStep
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry, ApplyProposal
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.plan import stage_by_key
from app.domain.project import Project
from app.domain.proposals import Proposal
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project


class ScriptedAgents:
    """Runs the mock agents, except for the scripted steps of a stage, used in order:
    an exception is raised, anything else (even an invalid dict) is returned as is."""

    def __init__(self, script: dict[str, list[Any]] | None = None):
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self._script = {key: list(steps) for key, steps in (script or {}).items()}
        self._mock = MockPlanningAgents(delay_seconds=0)

    def stages(self) -> list[str]:
        return [key for key, _ in self.calls]

    def context(self, key: str, call: int = -1) -> dict[str, Any]:
        return [c for k, c in self.calls if k == key][call]

    async def run_stage(self, stage, context):
        self.calls.append((stage.key, context))
        steps = self._script.get(stage.key)
        if steps:
            step = steps.pop(0)
            if isinstance(step, Exception):
                raise step
            return step
        return await self._mock.run_stage(stage, context)


@dataclass
class Pipeline:
    uow: InMemoryUnitOfWork
    bus: RecordingEventBus
    agents: ScriptedAgents
    run_step: RunPlanningStep
    advance: AdvancePlanning
    project: Project
    completed: list[int] = field(default_factory=list)

    def proposals(self, key: str | None = None) -> list[Proposal]:
        """Oldest first."""
        with self.uow:
            rows = self.uow.proposals.list_by_project(self.project.id)  # type: ignore[arg-type]
        return [p for p in reversed(rows) if key is None or p.key == key]

    def stored_project(self) -> Project:
        with self.uow:
            return self.uow.projects.get(self.project.id)  # type: ignore[arg-type,return-value]

    def seed(self, key: str, status: str = "approved", content: dict[str, Any] | None = None, **fields: Any) -> Proposal:
        """A plan_stage proposal as if the stage had run and been decided."""
        with self.uow:
            saved = self.uow.proposals.add(
                Proposal(
                    project_id=self.project.id,  # type: ignore[arg-type]
                    kind="plan_stage",
                    key=key,
                    agent=stage_by_key(key).title,
                    content=content or MOCK_PLAN[key],
                    status=status,  # type: ignore[arg-type]
                    **fields,
                )
            )
            self.uow.commit()
        return saved


def pipeline(agents: ScriptedAgents | None = None, **project_fields: Any) -> Pipeline:
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(**{"status": "planning", **project_fields}))
    uow.commit()
    bus = RecordingEventBus()
    agents = agents or ScriptedAgents()
    appliers = ApplierRegistry()
    completed: list[int] = []

    async def on_completed(project_id: int) -> None:
        completed.append(project_id)

    auto_approve = AutoApprove(uow.factory(), bus, ApplyProposal(uow.factory(), bus, appliers))
    run_step = RunPlanningStep(uow.factory(), agents, bus, auto_approve)
    advance = AdvancePlanning(uow.factory(), bus, run_step, [on_completed])
    appliers.register("plan_stage", advance.on_proposal_resolved, on=("decided", "rejected"))
    return Pipeline(uow, bus, agents, run_step, advance, saved, completed)
