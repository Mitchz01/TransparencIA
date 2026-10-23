import pytest

from app.application.dto import ProjectCreate
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.domain.errors import ProjectNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, account


def _create(**overrides) -> ProjectCreate:
    return ProjectCreate(**{"name": "Agile Planner", "description": "Plans the work.", **overrides})


def test_creates_a_draft_led_by_its_creator():
    uow = InMemoryUnitOfWork()
    ana = account(uow, role="Backend", seniority="senior", hours_per_week=30, skills=["Python"])
    project = CreateProject(uow).execute(_create(requested_methodology="scrum"), ana)

    assert project.id and project.status == "draft" and project.requested_methodology == "scrum"
    [leader] = project.members
    assert (leader.name, leader.role, leader.seniority, leader.hours_per_week, leader.skills) == ("Ana Gómez", "Backend", "senior", 30, ["Python"])
    assert leader.account_id == ana.id and leader.permission == "leader" and leader.id
    assert project.invite_token  # ready to share (spec 015, US4)
    assert GetProject(InMemoryUnitOfWork(uow.store)).execute(project.id) == project


def test_the_role_given_wins_and_is_required_without_one_in_the_profile():
    uow = InMemoryUnitOfWork()
    ana = account(uow, role="Backend")
    assert CreateProject(uow).execute(_create(role="Tech lead"), ana).members[0].role == "Tech lead"

    no_role = account(uow, "Leo Ruiz")
    with pytest.raises(ValidationFailed) as error:
        CreateProject(uow).execute(_create(), no_role)
    assert [(e.field, e.message) for e in error.value.errors] == [("role", "Required.")]


def test_invalid_input_saves_nothing():
    uow = InMemoryUnitOfWork()
    ana = account(uow, role="Backend")
    commits = uow.commits
    with pytest.raises(ValidationFailed):
        CreateProject(uow).execute(_create(duration_weeks=0), ana)
    assert uow.commits == commits and ListProjects(InMemoryUnitOfWork(uow.store)).execute(ana) == []


def test_get_unknown_project():
    with pytest.raises(ProjectNotFound):
        GetProject(InMemoryUnitOfWork()).execute(99)


def test_list_has_only_my_projects_newest_first_with_my_permission():
    uow = InMemoryUnitOfWork()
    ana, leo = account(uow, role="Backend"), account(uow, "Leo Ruiz", role="Frontend")
    first = CreateProject(uow).execute(_create(name="First"), ana)
    second = CreateProject(uow).execute(_create(name="Second"), ana)
    CreateProject(uow).execute(_create(name="Leo's"), leo)

    summaries = ListProjects(uow).execute(ana)
    assert [s.id for s in summaries] == [second.id, first.id]
    assert summaries[0].member_count == 1 and summaries[0].permission == "leader"
