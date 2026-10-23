"""UC-02 · Edit the project (spec 001, US3). The team changes through spec 015's member use cases."""

from app.application.dto import ProjectUpdate
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound
from app.domain.project import Project, apply_update


class UpdateProject:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, data: ProjectUpdate) -> Project:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        edited, _ = apply_update(project, data.to_changes())
        saved = self._uow.projects.save(edited)
        self._uow.commit()
        return saved
