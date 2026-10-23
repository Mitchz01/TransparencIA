"""Assemble the portal from the rules of domain/transparency.py (spec 017, US3). Owner: P3.
Only confirmed expenses count; nothing about the team (emails, hours, members) goes in."""

import datetime as dt
from collections.abc import Callable

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.transparency.set_publication import public_url_for
from app.domain.errors import ProjectNotFound
from app.domain.project import Project
from app.domain.transparency import (
    Alert,
    BudgetMissing,
    Expense,
    Portal,
    PortalProject,
    TeamPortal,
    end_date,
    line_status,
    sprint_progress,
    summary,
    weekly_timeline,
)


def _newest_first(expenses: list[Expense]) -> list[Expense]:
    return sorted(expenses, key=lambda e: (e.date or e.created_at.date(), e.id or 0), reverse=True)


class GetPortal:
    def __init__(self, uow: UnitOfWork, public_app_url: str, today: Callable[[], dt.date]):
        self._uow = uow
        self._public_app_url = public_app_url
        self._today = today

    def for_team(self, project_id: int) -> TeamPortal:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        portal = self._assemble(project)
        drafts = _newest_first(self._uow.expenses.list_by_project(project_id, "draft"))
        return TeamPortal(**portal.model_dump(), drafts=drafts, public=project.public)

    def for_public(self, slug: str) -> Portal:
        """Raises ProjectNotFound for an unknown or unpublished slug."""
        project = self._uow.projects.get_by_public_slug(slug)
        if project is None or not project.public:
            raise ProjectNotFound(None)
        return self._assemble(project)

    def _assemble(self, project: Project) -> Portal:
        assert project.id is not None
        budget = self._uow.budgets.get(project.id)
        if budget is None:
            if project.public:
                raise ProjectNotFound(None)  # published, then the budget vanished: nothing to show
            raise BudgetMissing(project.id)
        end = end_date(budget, project.duration_weeks)
        today = self._today()
        tasks = self._uow.tasks.list_by_project(project.id)
        sprints = self._uow.sprints.list_by_project(project.id)
        confirmed = _newest_first(self._uow.expenses.list_by_project(project.id, "confirmed"))
        alerts: list[Alert] = [alert for expense in confirmed for alert in expense.alerts]
        return Portal(
            project=PortalProject(
                name=project.name,
                description=project.description,
                contracting_entity=budget.contracting_entity,
                contractor=budget.contractor,
                contract_value=budget.contract_value,
                start_date=budget.start_date,
                end_date=end,
            ),
            summary=summary(budget, end, confirmed, tasks, today),
            lines=line_status(budget, confirmed),
            timeline=weekly_timeline(budget, end, confirmed, tasks, today),
            sprints=sprint_progress(sprints, tasks),
            expenses=confirmed,
            alerts=alerts,
            public_url=public_url_for(self._public_app_url, project.public_slug) if project.public else None,
        )
