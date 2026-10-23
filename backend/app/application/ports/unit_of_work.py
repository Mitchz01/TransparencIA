from collections.abc import Callable
from typing import Protocol, Self

from app.application.ports.repositories import (
    ActivityRepository,
    DocumentRepository,
    ObjectiveRepository,
    ProjectRepository,
    ProposalRepository,
    SprintRepository,
    TaskRepository,
)


class UnitOfWork(Protocol):
    """Groups the repos in one transaction: applying a plan writes the project,
    sprints and tasks, and it has to be all or nothing."""

    projects: ProjectRepository
    sprints: SprintRepository
    objectives: ObjectiveRepository
    tasks: TaskRepository
    proposals: ProposalRepository
    activity: ActivityRepository
    documents: DocumentRepository

    def __enter__(self) -> Self: ...
    def __exit__(self, *exc: object) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


# Opens a fresh UnitOfWork with its own DB session. Background work (spec 005's
# ApplyProposal, spec 002's stages) uses it instead of the request's session.
UnitOfWorkFactory = Callable[[], UnitOfWork]
