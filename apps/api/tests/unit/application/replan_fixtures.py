"""Spec 008: a project with an applied plan on the in-memory fakes, and replan wiring like
dependencies.wire_replanning (never Gemini: scripted or mock agents)."""

import asyncio
from dataclasses import dataclass, field
from typing import Any

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.application.use_cases.planning.apply_plan import ApplyPlan
from app.application.use_cases.planning.apply_replan import ApplyReplan, ReplanOutcome
from app.application.use_cases.planning.replan import Replan
from app.application.use_cases.proposals.apply_proposal import ApplierRegistry, ApplyProposal
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.board import Sprint, Task
from app.domain.project import Project
from app.domain.proposals import Proposal
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project
from tests.unit.application.planning_fixtures import ScriptedAgents

run = asyncio.run


@dataclass
class Planned:
    uow: InMemoryUnitOfWork
    bus: RecordingEventBus
    agents: ScriptedAgents
    project: Project
    replan: Replan
    apply_replan: ApplyReplan
    outcomes: list[ReplanOutcome] = field(default_factory=list)

    @property
    def pid(self) -> int:
        return self.project.id  # type: ignore[return-value]

    def tasks(self) -> dict[str, Task]:
        with self.uow:
            return {t.key: t for t in self.uow.tasks.list_by_project(self.pid)}

    def sprints(self) -> list[Sprint]:
        with self.uow:
            return self.uow.sprints.list_by_project(self.pid)

    def stored_project(self) -> Project:
        with self.uow:
            return self.uow.projects.get(self.pid)  # type: ignore[return-value]

    def replans(self) -> list[Proposal]:
        """Oldest first."""
        with self.uow:
            return [p for p in reversed(self.uow.proposals.list_by_project(self.pid)) if p.kind == "replan"]

    def update_task(self, key: str, **fields: Any) -> None:
        with self.uow:
            task = next(t for t in self.uow.tasks.list_by_project(self.pid) if t.key == key)
            self.uow.tasks.save(task.model_copy(update=fields))
            self.uow.commit()

    def add_replan(self, changes: list[dict[str, Any]], status: str = "approved", reason: str = "Leo left.", **fields: Any) -> Proposal:
        with self.uow:
            saved = self.uow.proposals.add(
                Proposal(
                    project_id=self.pid,
                    kind="replan",
                    key="replan",
                    agent="Scrum master",
                    content={"changes": changes, "rationale": "Adapt.", "reason": reason},
                    status=status,  # type: ignore[arg-type]
                    **fields,
                )
            )
            self.uow.commit()
        return saved


def planned(agents: ScriptedAgents | None = None, **project_fields: Any) -> Planned:
    """A ready project (Ana Gómez, Backend; Leo Ruiz, Frontend) with MOCK_PLAN's board:
    sprints 1-3 with US-1..US-11 in "todo"."""
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(status="planning", plan=MOCK_PLAN, **project_fields))
    uow.commit()
    run(ApplyPlan(uow.factory(), RecordingEventBus()).execute(saved.id))  # type: ignore[arg-type]
    with uow:
        saved = uow.projects.get(saved.id)  # type: ignore[arg-type,assignment]

    bus = RecordingEventBus()
    agents = agents or ScriptedAgents()
    outcomes: list[ReplanOutcome] = []

    async def record(outcome: ReplanOutcome) -> None:
        outcomes.append(outcome)

    appliers = ApplierRegistry()
    apply_replan = ApplyReplan(uow.factory(), bus, [record])
    appliers.register("replan", apply_replan.execute)
    auto_approve = AutoApprove(uow.factory(), bus, ApplyProposal(uow.factory(), bus, appliers))
    replan = Replan(uow.factory(), agents, bus, auto_approve.after_created)
    return Planned(uow, bus, agents, saved, replan, apply_replan, outcomes)  # type: ignore[arg-type]
