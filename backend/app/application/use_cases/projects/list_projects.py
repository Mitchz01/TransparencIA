"""List the caller's projects, newest first, with their permission in each (spec 001, US2; spec 015, FR-007)."""

from app.application.dto import ProjectSummary
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.accounts import Account, member_of


class ListProjects:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, account: Account) -> list[ProjectSummary]:
        projects = sorted(self._uow.projects.list_by_account(account.id or 0), key=lambda p: (p.created_at, p.id or 0), reverse=True)
        summaries = []
        for project in projects:
            member = member_of(project, account.id)
            if member is not None:
                summaries.append(ProjectSummary.of(project, member.permission))
        return summaries
