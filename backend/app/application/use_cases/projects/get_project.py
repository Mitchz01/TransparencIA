"""Read a project with its active team (spec 001, US2)."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound
from app.domain.project import Project


class GetProject:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> Project:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        return project
