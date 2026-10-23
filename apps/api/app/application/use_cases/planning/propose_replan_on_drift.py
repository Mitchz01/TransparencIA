"""Detect drift and propose a replan by itself (spec 008, US4, FR-010).

Two entry points, both hooks of other use cases, run in the background (the agent is slow):
- `on_sprint_closed`: CloseSprint's handler; a sprint closed with unfinished tasks.
- `on_team_changed`: spec 001's UpdateProject handler; joins, leaves and changes of role,
  seniority or hours (they change the capacity or who can take work). Renames and skills don't.

The replan's origin is "automatic": it always waits for the leader (FR-016). Without an
applied plan there's nothing to replan, and nothing happens."""

import logging

from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.planning.replan import Replan
from app.domain.errors import PlanNotApplied
from app.domain.events import SprintClosed, TeamChanged
from app.domain.proposals import REASON_MAX, Proposal

logger = logging.getLogger("agile")

# Member fields that change the capacity or who can be assigned work.
RELEVANT_MEMBER_FIELDS = ("role", "seniority", "hours_per_week")


def _fit(reason: str) -> str:
    return reason if len(reason) <= REASON_MAX else reason[: REASON_MAX - 1] + "…"


def team_drift_reason(event: TeamChanged) -> str | None:
    """Who joined, left or changed, or None if the change doesn't affect the plan."""
    parts = [f"{name} joined" for name in event.joined]
    parts += [f"{name} left" for name in event.left]
    for change in event.changed:
        fields = [f for f in change.fields if f in RELEVANT_MEMBER_FIELDS]
        if fields:
            parts.append(f"{change.name} changed ({', '.join(f.replace('_', ' ') for f in fields)})")
    return _fit("The team changed: " + "; ".join(parts) + ".") if parts else None


def sprint_drift_reason(sprint_name: str, pending_task_keys: list[str]) -> str | None:
    if not pending_task_keys:
        return None
    keys = ", ".join(pending_task_keys)
    return _fit(f"{sprint_name} was closed with {len(pending_task_keys)} unfinished task(s): {keys}.")


class ProposeReplanOnDrift:
    def __init__(self, uow_factory: UnitOfWorkFactory, replan: Replan):
        self._uow_factory = uow_factory
        self._replan = replan

    async def on_sprint_closed(self, event: SprintClosed) -> Proposal | None:
        with self._uow_factory() as uow:
            sprint = uow.sprints.get(event.sprint_id)
        reason = sprint_drift_reason(sprint.name if sprint else f"Sprint {event.sprint_id}", event.pending_task_keys)
        return await self._propose(event.project_id, reason)

    async def on_team_changed(self, event: TeamChanged) -> Proposal | None:
        return await self._propose(event.project_id, team_drift_reason(event))

    async def _propose(self, project_id: int | None, reason: str | None) -> Proposal | None:
        if reason is None or project_id is None:
            return None
        try:
            return await self._replan.request(project_id, reason, origin="automatic")
        except PlanNotApplied:
            return None  # no board yet: the plan itself will take the change into account
