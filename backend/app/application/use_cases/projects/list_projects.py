"""List projects, newest first (spec 001, US2)."""

from app.application.dto import ProjectSummary
from app.application.ports.unit_of_work import UnitOfWork


class ListProjects:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self) -> list[ProjectSummary]:
        projects = sorted(self._uow.projects.list(), key=lambda p: (p.created_at, p.id or 0), reverse=True)
        return [ProjectSummary.of(p) for p in projects]
