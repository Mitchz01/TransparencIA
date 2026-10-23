import pytest

from app.application.dto import ProjectUpdate
from app.application.use_cases.projects.update_project import UpdateProject
from app.domain.errors import MethodologyLocked, ProjectNotFound, ValidationFailed
from tests.fakes import InMemoryUnitOfWork, project


def _setup(**overrides):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(**overrides))
    uow.commit()
    return uow, saved


def test_partial_change_keeps_the_rest():
    uow, saved = _setup()
    result = UpdateProject(uow).execute(saved.id, ProjectUpdate(auto_approve=True))
    assert result.auto_approve and result.members == saved.members and result.name == saved.name


def test_the_team_isnt_edited_here():
    """Spec 015: `members` isn't a field any more; the team changes member by member."""
    uow, saved = _setup()
    body = ProjectUpdate.model_validate({"name": "New", "members": []})
    assert UpdateProject(uow).execute(saved.id, body).members == saved.members


def test_invalid_edit_changes_nothing():
    uow, saved = _setup()
    with pytest.raises(ValidationFailed):
        UpdateProject(uow).execute(saved.id, ProjectUpdate(duration_weeks=0))
    with pytest.raises(ValidationFailed):
        UpdateProject(uow).execute(saved.id, ProjectUpdate())
    assert uow.projects.get(saved.id) == saved


def test_methodology_locked_and_unknown_project():
    uow, saved = _setup(status="planning")
    with pytest.raises(MethodologyLocked):
        UpdateProject(uow).execute(saved.id, ProjectUpdate(requested_methodology="xp"))
    with pytest.raises(ProjectNotFound):
        UpdateProject(uow).execute(99, ProjectUpdate(name="X"))


def test_editing_while_planning_is_allowed():
    uow, saved = _setup(status="planning")
    assert UpdateProject(uow).execute(saved.id, ProjectUpdate(name="Renamed")).name == "Renamed"
