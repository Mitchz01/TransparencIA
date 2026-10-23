"""UC-13 · Replan an applied plan (spec 008, US2 and US4).

`prepare` runs in the request: the project must have an applied plan, the reason is checked,
and a pending replan is found so the new one replaces it with both reasons (FR-014).
`execute` runs in the background with its own UnitOfWork: the agent gets the approved plan,
the team, the board, the real velocity and the reason, with one retry on an invalid output
(spec 002's run_validated); the result is a `replan` proposal with its `origin`. Spec 005's
AutoApprove only approves it when the leader asked (origin "leader", FR-016)."""

from typing import Any

from app.application.dto import ReplanRun
from app.application.ports.agents import PlanningAgents
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.application.use_cases.integrations.propose_issues import AfterCreated
from app.application.use_cases.planning.context import project_context
from app.application.use_cases.planning.run_planning_step import StageFailed, run_validated
from app.application.use_cases.proposals.resolve_proposal import resolved_event
from app.domain.board import Sprint, Task, sprint_capacity, velocity
from app.domain.errors import PlanNotApplied, ProjectNotFound, ProposalAlreadyResolved, ValidationFailed
from app.domain.events import AgentFinished, AgentStarted, EventRef, ProposalCreated, ReplanFailed
from app.domain.plan import REPLAN_STAGE, ReplanContent
from app.domain.project import Project
from app.domain.proposals import REASON_MAX, Proposal, ProposalOrigin

KIND = KEY = "replan"


def clean_reason(reason: str) -> str:
    clean = reason.strip()
    if not clean:
        raise ValidationFailed.single("reason", "Required.")
    if len(clean) > REASON_MAX:
        raise ValidationFailed.single("reason", f"Max {REASON_MAX} characters.")
    return clean


def pending_replan(uow: UnitOfWork, project_id: int) -> Proposal | None:
    return next((p for p in uow.proposals.list_by_project(project_id) if p.kind == KIND and p.status == "pending"), None)


def board_context(project: Project, sprints: list[Sprint], tasks: list[Task]) -> dict[str, Any]:
    """What the agent sees of the board: sprints by number and tasks with their sprint number
    and assignee name (ids mean nothing to it)."""
    numbers = {s.id: s.number for s in sprints}
    names = {m.id: m.name for m in project.members}
    ordered = sorted(tasks, key=lambda t: (numbers.get(t.sprint_id, 10**6), t.position, t.id or 0))  # backlog last
    return {
        "sprints": [
            {"number": s.number, "name": s.name, "goal": s.goal, "closed": s.closed, "end_date": s.end_date.isoformat() if s.end_date else None}
            for s in sprints
        ],
        "tasks": [
            {
                "key": t.key,
                "title": t.title,
                "epic_key": t.epic_key,
                "status": t.status,
                "points": t.points,
                "sprint": numbers.get(t.sprint_id),
                "assignee": names.get(t.assignee_id),
                "missing_role": t.missing_role,
            }
            for t in ordered
        ],
    }


def velocity_context(project: Project, sprints: list[Sprint], tasks: list[Task]) -> dict[str, Any]:
    """Real pace (done points per closed sprint) next to the planned capacity."""
    done = velocity(sprints, tasks)
    return {
        "done_points_per_closed_sprint": done,
        "average": round(sum(done) / len(done), 1) if done else None,
        "points_per_sprint": sprint_capacity(project),
    }


def replan_context(project: Project, sprints: list[Sprint], tasks: list[Task], reason: str) -> dict[str, Any]:
    plan = project.plan or {}
    return {
        "project": project_context(project),
        "plan": {key: plan.get(key) for key in ("methodology", "roadmap") if key in plan},
        "board": board_context(project, sprints, tasks),
        "velocity": velocity_context(project, sprints, tasks),
        "reason": reason,
    }


class Replan:
    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        agents: PlanningAgents,
        bus: EventBus,
        after_created: AfterCreated | None = None,
    ):
        self._uow_factory = uow_factory
        self._agents = agents
        self._bus = bus
        self._after_created = after_created

    def prepare(self, project_id: int, reason: str, origin: ProposalOrigin = "leader") -> ReplanRun:
        """Raises ProjectNotFound, ValidationFailed (reason) or PlanNotApplied."""
        with self._uow_factory() as uow:
            project = uow.projects.get(project_id)
            if project is None:
                raise ProjectNotFound(project_id)
            clean = clean_reason(reason)
            if project.status != "ready":
                raise PlanNotApplied(project_id)
            pending = pending_replan(uow, project_id)
        if pending is None:
            return ReplanRun(project_id=project_id, reason=clean, origin=origin)
        previous = str(pending.content.get("reason") or "").strip()
        merged = clean if not previous or previous == clean else f"{previous}\n{clean}"
        return ReplanRun(project_id=project_id, reason=merged, origin=origin, supersedes=pending.id)

    async def request(self, project_id: int, reason: str, origin: ProposalOrigin = "leader") -> Proposal | None:
        """`prepare` and `execute` in one go, for callers already in the background (drift)."""
        return await self.execute(self.prepare(project_id, reason, origin))

    async def execute(self, run: ReplanRun) -> Proposal | None:
        """The new pending replan, or None if the agent failed (ReplanFailed is published)."""
        with self._uow_factory() as uow:
            project = uow.projects.get(run.project_id)
            if project is None:
                raise ProjectNotFound(run.project_id)
            context = replan_context(
                project, uow.sprints.list_by_project(run.project_id), uow.tasks.list_by_project(run.project_id), run.reason
            )

        stage = REPLAN_STAGE
        project_ref = EventRef(kind="project", id=run.project_id)
        await self._bus.publish(
            AgentStarted(
                project_id=run.project_id, agent=stage.key, title=stage.title, summary=f"{stage.title} is replanning", ref=project_ref
            )
        )
        try:
            output = await run_validated(self._agents, stage, context)
        except StageFailed as failure:
            await self._bus.publish(
                ReplanFailed(project_id=run.project_id, error=failure.message, summary="The replan failed", ref=project_ref)
            )
            return None

        content = ReplanContent.model_validate({**output, "reason": run.reason})
        with self._uow_factory() as uow:
            discarded = []
            for old in [p for p in uow.proposals.list_by_project(run.project_id) if p.kind == KIND and p.status == "pending"]:
                old.discard()  # FR-014: the new one carries both reasons
                try:
                    discarded.append(uow.proposals.save_if_status(old, "pending"))
                except ProposalAlreadyResolved:
                    pass  # the leader decided it meanwhile
            proposal = uow.proposals.add(
                Proposal(
                    project_id=run.project_id,
                    kind=KIND,
                    key=KEY,
                    agent=stage.title,
                    content=content.model_dump(mode="json"),
                    rationale=content.rationale,
                    origin=run.origin,
                )
            )
            uow.commit()

        for old in discarded:
            await self._bus.publish(resolved_event(old, actor="system"))
        await self._bus.publish(
            AgentFinished(
                project_id=run.project_id,
                agent=stage.key,
                title=stage.title,
                output=output,
                summary=f"{stage.title} finished the replan",
                ref=project_ref,
            )
        )
        who = "the leader" if run.origin == "leader" else "the system (the plan drifted)"
        await self._bus.publish(
            ProposalCreated(
                project_id=run.project_id,
                proposal_id=proposal.id or 0,
                kind=KIND,
                key=KEY,
                agent=stage.title,
                summary=f"{stage.title} proposed a replan with {len(content.changes)} change(s), asked by {who}",
                ref=EventRef(kind="proposal", id=proposal.id or 0),
            )
        )
        if self._after_created is not None:
            await self._after_created(proposal.id or 0)  # spec 005: never auto-approves an automatic one
        return proposal
