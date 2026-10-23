"""Spec 015's pure rules: account validation, unique names and who can do what."""

from datetime import datetime, timedelta, timezone

import pytest

from app.domain.accounts import (
    Account,
    can,
    check_access,
    ensure_leader,
    member_from_profile,
    new_session,
    normalize_email,
    project_role,
    signup_errors,
    token_digest,
    unique_name,
    validate_profile,
)
from app.domain.errors import Forbidden, LastLeader, ProjectNotFound, ValidationFailed
from app.domain.project import Member, Project


def _fields(errors) -> dict[str, str]:
    return {e.field: e.message for e in errors}


def test_emails_ignore_case_and_spaces():
    assert normalize_email("  Ana@Team.DEV ") == "ana@team.dev"


def test_signup_lists_every_failing_field():
    assert signup_errors("Ana", "ana@team.dev", "12345678") == []
    assert _fields(signup_errors("", "not-an-email", "short")) == {
        "name": "Required.",
        "email": "Must be an email address.",
        "password": "Must be between 8 and 128 characters.",
    }
    assert "name" in _fields(signup_errors("x" * 121, "a@b.co", "12345678"))


def test_profile_is_normalized_and_validated():
    account = Account(email="a@b.co", name="  Ana   Gómez ", role="  ", skills=["Python", " python ", ""], github_username="@ana-g")
    clean = validate_profile(account)
    assert (clean.name, clean.role, clean.skills, clean.github_username) == ("Ana Gómez", None, ["Python"], "ana-g")

    with pytest.raises(ValidationFailed) as error:
        validate_profile(Account(email="a@b.co", name="", role="x" * 61, hours_per_week=0, skills=["s" * 41], github_username="-bad-"))
    assert set(_fields(error.value.errors)) == {"name", "role", "hours_per_week", "skills[0]", "github_username"}


def test_project_role_prefers_the_one_given_and_is_required():
    account = Account(email="a@b.co", name="Ana", role="Backend")
    assert project_role(None, account) == "Backend"
    assert project_role(" Tech  lead ", account) == "Tech lead"
    assert project_role("  ", account) == "Backend"
    with pytest.raises(ValidationFailed):
        project_role(None, account.model_copy(update={"role": None}))
    with pytest.raises(ValidationFailed):
        project_role("x" * 61, account)


def test_unique_name_adds_a_number():
    assert unique_name("Ana Gómez", ["Leo"]) == "Ana Gómez"
    assert unique_name("Ana Gómez", ["ana  gómez"]) == "Ana Gómez 2"
    assert unique_name("Ana Gómez", ["Ana Gómez", "Ana Gómez 2"]) == "Ana Gómez 3"


def test_member_from_profile_copies_the_profile():
    account = Account(id=7, email="a@b.co", name="Ana", seniority="senior", hours_per_week=30, skills=["SQL"], github_username="ana")
    member = member_from_profile(account, "Backend", "member", ["Ana"])
    assert member.model_dump(exclude={"id"}) == {
        "name": "Ana 2",
        "role": "Backend",
        "seniority": "senior",
        "hours_per_week": 30,
        "skills": ["SQL"],
        "github_username": "ana",
        "account_id": 7,
        "permission": "member",
    }


def test_permissions():
    assert all(can("leader", action) for action in ("view", "work", "manage"))
    assert can("member", "view") and can("member", "work") and not can("member", "manage")


def test_check_access():
    project = Project(
        id=3,
        name="P",
        description="d",
        members=[Member(id=1, name="Ana", role="B", account_id=10, permission="leader"), Member(id=2, name="Leo", role="F", account_id=20)],
    )
    assert check_access(project, 10, "manage").id == 1
    assert check_access(project, 20, "work").id == 2
    with pytest.raises(Forbidden):
        check_access(project, 20, "manage")
    with pytest.raises(ProjectNotFound):
        check_access(project, 30, "view")
    with pytest.raises(ProjectNotFound):
        check_access(project, None, "view")


def test_a_project_keeps_a_leader():
    ensure_leader([Member(name="Ana", role="B", permission="leader")])
    with pytest.raises(LastLeader):
        ensure_leader([Member(name="Leo", role="F")])


def test_sessions_last_30_days_and_store_a_digest():
    now = datetime(2026, 10, 23, tzinfo=timezone.utc)
    session = new_session(1, token_digest("t"), now)
    assert session.token_digest != "t" and len(session.token_digest) == 64
    assert not session.expired(now + timedelta(days=29)) and session.expired(now + timedelta(days=30))


def test_the_password_hash_is_never_serialized():
    account = Account(email="a@b.co", name="Ana", password_hash="secret")
    assert "password_hash" not in account.model_dump() and "secret" not in account.model_dump_json()
