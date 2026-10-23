import pytest

from app.application.dto import MemberCreate, ProjectCreate
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.domain.errors import ProjectNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork


def _create(**overrides) -> ProjectCreate:
    data = {
        "name": "Agile Planner",
        "description": "Plans the work.",
        "members": [MemberCreate(name="Ana", role="Backend"), MemberCreate(name="Leo", role="Frontend")],
    }
    return ProjectCreate(**{**data, **overrides})


def test_creates_a_draft_with_ids():
    uow = InMemoryUnitOfWork()
    project = CreateProject(uow).execute(_create(requested_methodology="scrum"))
    assert project.id and project.status == "draft" and project.requested_methodology == "scrum"
    assert all(m.id for m in project.members) and uow.commits == 1
    assert GetProject(InMemoryUnitOfWork(uow.store)).execute(project.id) == project


def test_invalid_input_saves_nothing():
    uow = InMemoryUnitOfWork()
    with pytest.raises(ValidationFailed):
        CreateProject(uow).execute(_create(members=[], duration_weeks=0))
    assert uow.commits == 0 and ListProjects(InMemoryUnitOfWork(uow.store)).execute() == []


def test_get_unknown_project():
    with pytest.raises(ProjectNotFound):
        GetProject(InMemoryUnitOfWork()).execute(99)


def test_list_is_newest_first():
    uow = InMemoryUnitOfWork()
    first = CreateProject(uow).execute(_create(name="First"))
    second = CreateProject(uow).execute(_create(name="Second"))
    summaries = ListProjects(uow).execute()
    assert [s.id for s in summaries] == [second.id, first.id]
    assert summaries[0].member_count == 2
