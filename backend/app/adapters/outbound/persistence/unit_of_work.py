from typing import Self

from sqlmodel import Session

from app.adapters.outbound.persistence.repositories import (
    SqlProjectRepository,
    SqlSprintRepository,
    SqlTaskRepository,
)


class SqlUnitOfWork:
    def __init__(self, session: Session):
        self._session = session
        self.projects = SqlProjectRepository(session)
        self.sprints = SqlSprintRepository(session)
        self.tasks = SqlTaskRepository(session)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, exc_type, *_: object) -> None:
        # Si no se llamó a commit (o hubo excepción), no queda nada a medias.
        self.rollback()

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
