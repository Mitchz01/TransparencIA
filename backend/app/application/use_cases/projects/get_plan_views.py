"""UC-07 · Roadmap, methodology and architecture views (spec 004). Read-only (FR-009)."""

from collections.abc import Callable
from datetime import date

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound
from app.domain.plan_views import PlanViews, build_plan_views


class GetPlanViews:
    def __init__(self, uow: UnitOfWork, today: Callable[[], date]):
        self._uow = uow
        self._today = today

    def execute(self, project_id: int) -> PlanViews:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        proposals = self._uow.proposals.list_by_project(project_id)
        tasks = self._uow.tasks.list_by_project(project_id)
        return build_plan_views(project, proposals, tasks, self._today())
