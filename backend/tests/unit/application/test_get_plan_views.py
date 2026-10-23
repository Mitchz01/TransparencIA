from datetime import date

import pytest

from app.application.use_cases.projects.get_plan_views import GetPlanViews
from app.domain.errors import ProjectNotFound
from tests.fakes import InMemoryUnitOfWork, project


def test_reads_without_writing():
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project())
    uow.commit()
    commits = uow.commits
    views = GetPlanViews(uow, lambda: date(2026, 10, 23)).execute(saved.id)
    assert views.roadmap.status == "not_generated" and uow.commits == commits


def test_unknown_project():
    with pytest.raises(ProjectNotFound):
        GetPlanViews(InMemoryUnitOfWork(), date.today).execute(99)
