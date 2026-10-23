from typing import Protocol, Self

from app.application.ports.repositories import ProjectRepository, SprintRepository, TaskRepository


class UnitOfWork(Protocol):
    """Groups the repos in one transaction: applying a plan writes the project,
    sprints and tasks, and it has to be all or nothing."""

    projects: ProjectRepository
    sprints: SprintRepository
    tasks: TaskRepository

    def __enter__(self) -> Self: ...
    def __exit__(self, *exc: object) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
