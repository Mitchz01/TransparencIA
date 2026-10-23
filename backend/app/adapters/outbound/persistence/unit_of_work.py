from typing import Self

from sqlmodel import Session

from app.adapters.outbound.persistence.repositories import (
    SqlActivityRepository,
    SqlExternalLinkRepository,
    SqlObjectiveRepository,
    SqlOwnWriteRepository,
    SqlProjectRepository,
    SqlProposalRepository,
    SqlSprintRepository,
    SqlTaskRepository,
)


class SqlUnitOfWork:
    def __init__(self, session: Session, *, owns_session: bool = False):
        self._session = session
        self._owns_session = owns_session
        self.projects = SqlProjectRepository(session)
        self.sprints = SqlSprintRepository(session)
        self.objectives = SqlObjectiveRepository(session)
        self.tasks = SqlTaskRepository(session)
        self.proposals = SqlProposalRepository(session)
        self.activity = SqlActivityRepository(session)
        self.links = SqlExternalLinkRepository(session)  # spec 007
        self.own_writes = SqlOwnWriteRepository(session)  # spec 007

    def __enter__(self) -> Self:
        return self

    def __exit__(self, exc_type, *_: object) -> None:
        # If commit wasn't called (or there was an exception), nothing is left half done.
        self.rollback()
        if self._owns_session:
            self._session.close()

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
