from __future__ import annotations

from sqlalchemy import update
from sqlmodel import Session, col, select

from app.adapters.outbound.persistence import mappers
from app.adapters.outbound.persistence.tables import (
    ActivityTable,
    MemberTable,
    ProjectTable,
    ProposalTable,
    SprintTable,
    TaskTable,
)
from app.domain.board import Sprint, Task
from app.domain.errors import ProposalAlreadyResolved
from app.domain.events import DomainEvent
from app.domain.project import Project
from app.domain.proposals import Proposal, ProposalStatus


class SqlProjectRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, project_id: int) -> Project | None:
        row = self._session.get(ProjectTable, project_id)
        return self._to_domain(row) if row else None

    def list(self) -> list[Project]:
        rows = self._session.exec(select(ProjectTable).order_by(ProjectTable.id)).all()
        return [self._to_domain(row) for row in rows]

    def add(self, project: Project) -> Project:
        row = mappers.project_to_table(project)
        self._session.add(row)
        self._session.flush()
        for member in project.members:
            self._session.add(mappers.member_to_table(member, row.id))
        self._session.flush()
        return self._to_domain(row)

    def save(self, project: Project) -> Project:
        """Saves the project and syncs its team: members with an id are updated, members
        without one are inserted, and current members missing from the list are deactivated
        (never deleted, so done tasks keep their assignee)."""
        row = self._session.merge(mappers.project_to_table(project))
        # Read the current team before inserting, or autoflush would count new members as missing.
        current_members = self._active_members(row.id)
        kept = {m.id for m in project.members if m.id is not None}
        for current in current_members:
            if current.id not in kept:
                current.active = False
                self._session.add(current)
        for member in project.members:
            member_row = mappers.member_to_table(member, row.id)
            if member.id is None:
                self._session.add(member_row)
            else:
                self._session.merge(member_row)
        self._session.flush()
        return self._to_domain(row)

    def _active_members(self, project_id: int | None) -> list[MemberTable]:
        return list(
            self._session.exec(
                select(MemberTable)
                .where(MemberTable.project_id == project_id, col(MemberTable.active).is_(True))
                .order_by(MemberTable.id)
            ).all()
        )

    def _to_domain(self, row: ProjectTable) -> Project:
        return mappers.project_to_domain(row, self._active_members(row.id))


class SqlSprintRepository:
    def __init__(self, session: Session):
        self._session = session

    def list_by_project(self, project_id: int) -> list[Sprint]:
        rows = self._session.exec(
            select(SprintTable).where(SprintTable.project_id == project_id).order_by(SprintTable.number)
        ).all()
        return [mappers.sprint_to_domain(row) for row in rows]

    def add(self, sprint: Sprint) -> Sprint:
        row = mappers.sprint_to_table(sprint)
        self._session.add(row)
        self._session.flush()
        return mappers.sprint_to_domain(row)


class SqlTaskRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, task_id: int) -> Task | None:
        row = self._session.get(TaskTable, task_id)
        return mappers.task_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Task]:
        rows = self._session.exec(
            select(TaskTable).where(TaskTable.project_id == project_id).order_by(TaskTable.position)
        ).all()
        return [mappers.task_to_domain(row) for row in rows]

    def add(self, task: Task) -> Task:
        row = mappers.task_to_table(task)
        self._session.add(row)
        self._session.flush()
        return mappers.task_to_domain(row)

    def save(self, task: Task) -> Task:
        row = self._session.merge(mappers.task_to_table(task))
        self._session.flush()
        return mappers.task_to_domain(row)


class SqlProposalRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, proposal_id: int) -> Proposal | None:
        row = self._session.get(ProposalTable, proposal_id)
        return mappers.proposal_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Proposal]:
        """Newest first."""
        rows = self._session.exec(
            select(ProposalTable)
            .where(ProposalTable.project_id == project_id)
            .order_by(col(ProposalTable.created_at).desc(), col(ProposalTable.id).desc())
        ).all()
        return [mappers.proposal_to_domain(row) for row in rows]

    def add(self, proposal: Proposal) -> Proposal:
        row = mappers.proposal_to_table(proposal)
        self._session.add(row)
        self._session.flush()
        return mappers.proposal_to_domain(row)

    def save(self, proposal: Proposal) -> Proposal:
        row = self._session.merge(mappers.proposal_to_table(proposal))
        self._session.flush()
        return mappers.proposal_to_domain(row)

    def save_if_status(self, proposal: Proposal, expected: ProposalStatus) -> Proposal:
        """Saves only if the stored row is still in `expected`: of two simultaneous
        decisions, the second one gets ProposalAlreadyResolved."""
        values = mappers.proposal_to_table(proposal).model_dump(exclude={"id"})
        result = self._session.exec(  # type: ignore[call-overload]
            update(ProposalTable)
            .where(col(ProposalTable.id) == proposal.id, col(ProposalTable.status) == expected)
            .values(**values)
        )
        if result.rowcount == 0:
            current = self._session.get(ProposalTable, proposal.id)
            raise ProposalAlreadyResolved(proposal.id, current.status if current else "missing")
        self._session.flush()
        self._session.expire_all()
        return self.get(proposal.id)  # type: ignore[arg-type, return-value]


class SqlActivityRepository:
    """Read side of the activity log; PersistentEventBus writes it."""

    def __init__(self, session: Session):
        self._session = session

    def add(self, event: DomainEvent) -> DomainEvent:
        row = mappers.activity_to_table(event)
        self._session.add(row)
        self._session.flush()
        return mappers.activity_to_domain(row)

    def list_recent(self, project_id: int, before_seq: int | None, limit: int) -> list[DomainEvent]:
        """Newest first, strictly before `before_seq` when given."""
        query = select(ActivityTable).where(ActivityTable.project_id == project_id)
        if before_seq is not None:
            query = query.where(col(ActivityTable.id) < before_seq)
        rows = self._session.exec(query.order_by(col(ActivityTable.id).desc()).limit(limit)).all()
        return [mappers.activity_to_domain(row) for row in rows]

    def list_after(self, project_id: int, after_seq: int, limit: int) -> list[DomainEvent]:
        """Oldest first, strictly after `after_seq` (SSE replay)."""
        rows = self._session.exec(
            select(ActivityTable)
            .where(ActivityTable.project_id == project_id, col(ActivityTable.id) > after_seq)
            .order_by(col(ActivityTable.id))
            .limit(limit)
        ).all()
        return [mappers.activity_to_domain(row) for row in rows]
