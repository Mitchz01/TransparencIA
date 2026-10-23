"""UC-08 · The writer proposes the project's documents once the plan is complete (spec 006).

An `on_plan_completed` handler of spec 002 (after spec 003's ApplyPlan), in the background
with its own UnitOfWork. It runs the general spec first (FR-001); each output becomes a
`document` proposal, so nothing exists as a document until it's approved (FR-002). The agent
call, its retry and the events are spec 002's (run_agent). A document that still fails after
its retry isn't proposed: DocumentsGenerated names it in `missing`; the project isn't put in
`error`, because its plan and board are already done."""

import logging
from typing import Any

from app.application.ports.agents import PlanningAgents
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.planning.context import approved_outputs, build_document_context, rejection_feedback
from app.application.use_cases.planning.run_planning_step import OutputCheck, StageFailed, run_agent
from app.application.use_cases.proposals.auto_approve import AutoApprove
from app.domain.documents import document_kind
from app.domain.errors import ProjectNotFound
from app.domain.events import (
    AgentFinished,
    AgentStarted,
    DocumentsGenerated,
    EventRef,
    ProposalCreated,
    StageNeedsLeader,
)
from app.domain.plan import PlanningStage, document_stage
from app.domain.project import Project
from app.domain.proposals import MAX_CONSECUTIVE_REJECTIONS, Proposal, consecutive_rejections

logger = logging.getLogger("agile")


def _no_issues(output: dict[str, Any], context: dict[str, Any]) -> list[str]:
    return []


class GenerateDocuments:
    def __init__(self, uow_factory: UnitOfWorkFactory, agents: PlanningAgents, bus: EventBus, auto_approve: AutoApprove):
        self._uow_factory = uow_factory
        self._agents = agents
        self._bus = bus
        self._auto_approve = auto_approve
        # (project_id, key) of the documents being rewritten right now. The instance is built once
        # at startup (wire_documents), so every request sees the same set.
        self._running: set[tuple[int, str]] = set()

    async def execute(self, project_id: int) -> None:
        project, outputs, taken = self._load(project_id)
        proposed = 0
        missing: list[str] = []

        if "general_spec" not in taken:
            stage = document_stage("general_spec")
            context = build_document_context(stage, project, outputs)
            if await self._write(project_id, "general_spec", stage, context, "the general spec"):
                proposed += 1
            else:
                missing.append("General spec")

        await self._bus.publish(
            DocumentsGenerated(
                project_id=project_id,
                proposed=proposed,
                missing=missing,
                summary=f"The writer proposed {proposed} documents"
                + (f"; missing: {', '.join(missing)}" if missing else ""),
                ref=EventRef(kind="project", id=project_id),
            )
        )

    # ---------- One document again: a rejection's redo, or the leader's regeneration (US4) ----------

    def claim(self, project_id: int, key: str) -> bool:
        """Marks the document as being rewritten; False if it already is (409 regeneration_in_progress)."""
        if (project_id, key) in self._running:
            return False
        self._running.add((project_id, key))
        return True

    def is_running(self, project_id: int, key: str) -> bool:
        return (project_id, key) in self._running

    async def regenerate(self, project_id: int, key: str, feedback: dict[str, Any]) -> None:
        """Rewrites one document with `feedback` ({reason, rejected_content}, spec 002's shape) and
        proposes it under the same key, so approving it versions the same document."""
        self._running.add((project_id, key))
        try:
            project, outputs, _ = self._load(project_id)
            written = await self._rewrite(project, outputs, key, feedback)
        finally:
            self._running.discard((project_id, key))
        if not written:
            await self._bus.publish(
                DocumentsGenerated(
                    project_id=project_id,
                    proposed=0,
                    missing=[key],
                    summary=f"The writer couldn't rewrite {key}",
                    ref=EventRef(kind="project", id=project_id),
                )
            )

    async def on_proposal_resolved(self, proposal_id: int) -> None:
        """The `document` applier for rejections (spec 005): spec 002's redo rule. The document is
        rewritten with the reason as feedback until it's rejected MAX_CONSECUTIVE_REJECTIONS times
        in a row; then it waits for the leader, who adjusts the last proposal (spec 005, US4)."""
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            if proposal is None or proposal.kind != "document" or proposal.status != "rejected":
                return
            history = [p for p in uow.proposals.list_by_project(proposal.project_id) if p.subject == proposal.subject]
        rejections = consecutive_rejections(history)
        if rejections >= MAX_CONSECUTIVE_REJECTIONS:
            await self._bus.publish(
                StageNeedsLeader(
                    project_id=proposal.project_id,
                    stage=proposal.key,
                    rejections=rejections,
                    summary=f"The {proposal.key} document was rejected {rejections} times in a row: it needs you",
                    ref=EventRef(kind="proposal", id=proposal_id),
                )
            )
            return
        await self.regenerate(proposal.project_id, proposal.key, rejection_feedback(proposal))

    async def _rewrite(
        self, project: Project, outputs: dict[str, dict[str, Any]], key: str, feedback: dict[str, Any]
    ) -> bool:
        project_id: int = project.id  # type: ignore[assignment]
        kind = document_kind(key)
        if kind == "general_spec":
            stage = document_stage("general_spec")
            context = build_document_context(stage, project, outputs, feedback=feedback)
            return await self._write(project_id, key, stage, context, "the general spec")
        return False

    def _load(self, project_id: int) -> tuple[Project, dict[str, dict[str, Any]], set[str]]:
        """The project, its approved stage finals, and the document keys already proposed and
        not rejected: running again after a partial failure doesn't duplicate them."""
        with self._uow_factory() as uow:
            project = uow.projects.get(project_id)
            if project is None:
                raise ProjectNotFound(project_id)
            proposals = uow.proposals.list_by_project(project_id)
        taken = {p.key for p in proposals if p.kind == "document" and (p.decided or p.status == "pending")}
        return project, approved_outputs(proposals), taken

    async def _write(
        self,
        project_id: int,
        key: str,
        stage: PlanningStage,
        context: dict[str, Any],
        label: str,
        check: OutputCheck = _no_issues,
    ) -> bool:
        """Runs one document's agent and proposes its output; False if it failed after the retry."""
        await self._started(project_id, stage, label)
        try:
            output, issues = await run_agent(self._agents, stage, context, check)
        except StageFailed:
            return False
        if issues:
            logger.warning("Document %s still broke its rules after the retry: %s", key, issues)
            return False
        await self._finished(project_id, stage, output, label)
        await self._propose(project_id, key, stage, output)
        return True

    async def _started(self, project_id: int, stage: PlanningStage, label: str) -> None:
        # FR-010: the UI shows live which document is being written.
        await self._bus.publish(
            AgentStarted(
                project_id=project_id,
                agent=stage.key,
                title=stage.title,
                summary=f"{stage.title} is writing {label}",
                ref=EventRef(kind="project", id=project_id),
            )
        )

    async def _finished(self, project_id: int, stage: PlanningStage, output: dict[str, Any], label: str) -> None:
        await self._bus.publish(
            AgentFinished(
                project_id=project_id,
                agent=stage.key,
                title=stage.title,
                output=output,
                summary=f"{stage.title} finished {label}",
                ref=EventRef(kind="project", id=project_id),
            )
        )

    async def _propose(self, project_id: int, key: str, stage: PlanningStage, content: dict[str, Any]) -> Proposal:
        with self._uow_factory() as uow:
            proposal = uow.proposals.add(
                Proposal(
                    project_id=project_id,
                    kind="document",
                    key=key,
                    agent=stage.title,
                    content=content,
                    rationale=content.get("rationale", ""),
                )
            )
            uow.commit()
        await self._bus.publish(
            ProposalCreated(
                project_id=project_id,
                proposal_id=proposal.id,  # type: ignore[arg-type]
                kind=proposal.kind,
                key=proposal.key,
                agent=proposal.agent,
                summary=f"{stage.title} proposed {content.get('title', key)}",
                ref=EventRef(kind="proposal", id=proposal.id),  # type: ignore[arg-type]
            )
        )
        await self._auto_approve.after_created(proposal.id)  # type: ignore[arg-type]
        return proposal
