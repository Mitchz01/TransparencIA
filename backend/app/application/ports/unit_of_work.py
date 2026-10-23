from typing import Protocol, Self

from app.application.ports.repositories import ProjectRepository, SprintRepository, TaskRepository


class UnitOfWork(Protocol):
    """Agrupa los repos en una transacción: aplicar un plan escribe proyecto,
    sprints y tareas, y tiene que ser todo o nada."""

    projects: ProjectRepository
    sprints: SprintRepository
    tasks: TaskRepository

    def __enter__(self) -> Self: ...
    def __exit__(self, *exc: object) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
