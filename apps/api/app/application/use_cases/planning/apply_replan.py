"""Apply an approved (or adjusted) replan (spec 008, US2). Spec 005 calls it through the
applier registry with the proposal id; it opens its own UnitOfWork.

Every applicable change is written in one commit, or none if something fails (FR-012).
A change whose task is no longer as the proposal expected (it moved, was done or removed
meanwhile) is skipped and reported in ReplanApplied. Done tasks never change (FR-011).

Follow-ups run after the commit with the outcome: spec 007 proposes publishing the added
tasks as issues and closes the issues of discarded ones as "not planned"; objectives are
re-evaluated; spec 006 will mark the documents outdated."""

import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.domain.board import (
    Sprint,
    Task,
    assign,
    find_member,
    is_continuous,
    reorder,
    replan_change_problem,
    replan_status,
    task_from_story,
)
from app.domain.errors import ProjectNotFound, ProposalNotFound
from app.domain.events import EventRef, ReplanApplied, ReplanDiscardedChange
from app.domain.plan import ReplanChange, ReplanContent
from app.domain.project import Member, Project

logger = logging.getLogger("agile")


@dataclass
class DiscardedTask:
    task_id: int
    key: str
    rationale: str


@dataclass
class ReplanOutcome:
    project_id: int
    proposal_id: int
    applied: list[str] = field(default_factory=list)
    discarded_changes: list[ReplanDiscardedChange] = field(default_factory=list)
    added_task_ids: list[int] = field(default_factory=list)
    discarded_tasks: list[DiscardedTask] = field(default_factory=list)  # tasks removed by "discard" changes


ReplanFollowUp = Callable[[ReplanOutcome], Awaitable[None]]


class ApplyReplan:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, follow_ups: Sequence[ReplanFollowUp] = ()):
        self._uow_factory = uow_factory
        self._bus = bus
        self._follow_ups = follow_ups  # the shared list: follow-ups registered later still run

    async def execute(self, proposal_id: int) -> ReplanOutcome:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            if proposal is None:
                raise ProposalNotFound(proposal_id)
            project = uow.projects.get(proposal.project_id)
            if project is None:
                raise ProjectNotFound(proposal.project_id)
            content = ReplanContent.model_validate(proposal.final_content)
            outcome = ReplanOutcome(project_id=project.id or 0, proposal_id=proposal_id)
            _Applier(uow, project, outcome).apply(content.changes)
            proposal.result = {
                "applied": outcome.applied,
                "discarded": [d.model_dump() for d in outcome.discarded_changes],
            }
            uow.proposals.save(proposal)
            uow.commit()

        summary = f"Replan applied: {len(outcome.applied)} change(s)"
        if outcome.discarded_changes:
            summary += f", {len(outcome.discarded_changes)} discarded because the board changed"
        await self._bus.publish(
            ReplanApplied(
                project_id=outcome.project_id,
                summary=summary,
                ref=EventRef(kind="proposal", id=proposal_id),
                proposal_id=proposal_id,
                applied=outcome.applied,
                discarded=outcome.discarded_changes,
            )
        )
        for follow_up in list(self._follow_ups):
            try:
                await follow_up(outcome)
            except Exception:  # noqa: BLE001  the board already changed: a follow-up never undoes it
                logger.warning("A follow-up of replan %s failed", proposal_id, exc_info=True)
        return outcome


class _Applier:
    """Writes the changes on one UnitOfWork, without committing."""

    def __init__(self, uow: UnitOfWork, project: Project, outcome: ReplanOutcome):
        self._uow = uow
        self._project = project
        self._outcome = outcome
        self._pid = project.id or 0
        self._members: list[Member] = project.members
        sprints = uow.sprints.list_by_project(self._pid)
        self._open_sprints: dict[int, Sprint] = {s.number: s for s in sprints if not s.closed}
        # The board as it was when applying started: expected statuses are checked against it.
        self._snapshot: dict[str, Task] = {t.key: t for t in uow.tasks.list_by_project(self._pid)}

    def apply(self, changes: list[ReplanChange]) -> None:
        for change in changes:
            key = change.new_story.key if change.kind == "add" and change.new_story else change.task_key or ""
            problem = replan_change_problem(change, self._snapshot, self._open_sprints, self._members)
            if problem is None and change.kind != "add" and self._current(key) is None:
                problem = "task no longer on the board"  # discarded by an earlier change of this replan
            if problem is not None:
                self._outcome.discarded_changes.append(ReplanDiscardedChange(task_key=key, reason=problem))
                continue
            getattr(self, f"_{change.kind}")(change)
            self._outcome.applied.append(key)

    def _current(self, key: str) -> Task | None:
        return next((t for t in self._uow.tasks.list_by_project(self._pid) if t.key == key), None)

    def _sprint_id(self, number: int | None) -> int | None:
        return None if number is None else self._open_sprints[number].id

    def _move(self, change: ReplanChange) -> None:
        task = self._current(change.task_key or "")
        sprint_id = self._sprint_id(change.to_sprint)
        status = replan_status(task, sprint_id)  # type: ignore[arg-type]
        tasks = self._uow.tasks.list_by_project(self._pid)
        for moved in reorder(tasks, task.id, status, None, sprint_id, continuous=is_continuous(self._project)):  # type: ignore[union-attr, arg-type]
            self._uow.tasks.save(moved)

    def _reassign(self, change: ReplanChange) -> None:
        task = self._current(change.task_key or "")
        member = find_member(self._members, change.to_member)
        self._uow.tasks.save(task.model_copy(update={"assignee_id": member.id, "missing_role": None}))  # type: ignore[union-attr]

    def _add(self, change: ReplanChange) -> None:
        story = change.new_story
        sprint_id = self._sprint_id(change.to_sprint)
        status = "todo" if sprint_id is not None else "backlog"
        column = [t for t in self._uow.tasks.list_by_project(self._pid) if t.sprint_id == sprint_id and t.status == status]
        task = task_from_story(self._pid, story, status, len(column)).model_copy(update={"sprint_id": sprint_id})  # type: ignore[arg-type]
        task.assignee_id, task.missing_role = assign(story, None, self._members, {})  # type: ignore[arg-type]
        saved = self._uow.tasks.add(task)
        self._outcome.added_task_ids.append(saved.id or 0)

    def _discard(self, change: ReplanChange) -> None:
        task = self._current(change.task_key or "")
        self._uow.tasks.delete(task.id or 0)  # type: ignore[union-attr]
        self._outcome.discarded_tasks.append(DiscardedTask(task_id=task.id or 0, key=task.key, rationale=change.rationale))  # type: ignore[union-attr]
