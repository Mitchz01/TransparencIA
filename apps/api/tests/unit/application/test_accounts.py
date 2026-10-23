"""Spec 015, US1 and US2: sign up, sign in, sign out, sessions and the profile."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.application.dto import ProfileUpdate, SignInRequest, SignUpRequest
from app.application.use_cases.accounts.authenticate import Authenticate
from app.application.use_cases.accounts.sessions import PruneSessions
from app.application.use_cases.accounts.sign_in import SignIn
from app.application.use_cases.accounts.sign_out import SignOut
from app.application.use_cases.accounts.sign_up import SignUp
from app.application.use_cases.accounts.update_profile import UpdateProfile
from app.domain.accounts import token_digest
from app.domain.errors import InvalidCredentials, NotAuthenticated, ValidationFailed
from app.domain.project import Member, Project
from tests.fakes import InMemoryUnitOfWork, PlainHasher, RecordingEventBus

NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


def _sign_up(uow, email="ana@team.dev", name="Ana Gómez"):
    return SignUp(uow, PlainHasher(), lambda: NOW).execute(SignUpRequest(name=name, email=email, password="secret-123"))


def test_sign_up_creates_the_account_and_a_session():
    uow = InMemoryUnitOfWork()
    signed_in = _sign_up(uow, email=" Ana@Team.dev ", name=" Ana  Gómez ")
    account = signed_in.account
    assert (account.email, account.name, account.role, account.seniority, account.hours_per_week) == ("ana@team.dev", "Ana Gómez", None, "mid", 20)
    assert account.password_hash == "plain$secret-123"
    session = uow.sessions.get_by_digest(token_digest(signed_in.token))
    assert session.account_id == account.id and session.expires_at == NOW + timedelta(days=30)
    assert Authenticate(InMemoryUnitOfWork(uow.store), lambda: NOW).execute(signed_in.token) == account


def test_sign_up_rejects_a_taken_email_and_invalid_fields():
    uow = InMemoryUnitOfWork()
    _sign_up(uow)
    with pytest.raises(ValidationFailed) as error:
        _sign_up(uow, email="ANA@team.dev ")
    assert [(e.field, e.message) for e in error.value.errors] == [("email", "Already registered.")]
    with pytest.raises(ValidationFailed):
        SignUp(uow, PlainHasher()).execute(SignUpRequest(name="", email="x", password="1"))


def test_sign_in_and_the_same_error_for_both_failures():
    uow = InMemoryUnitOfWork()
    _sign_up(uow)
    sign_in = SignIn(uow, PlainHasher(), lambda: NOW)
    signed_in = sign_in.execute(SignInRequest(email="ANA@team.dev", password="secret-123"))
    assert signed_in.account.email == "ana@team.dev" and signed_in.token

    with pytest.raises(InvalidCredentials) as wrong:
        sign_in.execute(SignInRequest(email="ana@team.dev", password="nope-nope"))
    with pytest.raises(InvalidCredentials) as unknown:
        sign_in.execute(SignInRequest(email="leo@team.dev", password="secret-123"))
    assert wrong.value.detail == unknown.value.detail


def test_sign_out_ends_only_that_session():
    uow = InMemoryUnitOfWork()
    first = _sign_up(uow).token
    second = SignIn(uow, PlainHasher()).execute(SignInRequest(email="ana@team.dev", password="secret-123")).token
    SignOut(uow).execute(first)
    SignOut(uow).execute(first)  # idempotent
    SignOut(uow).execute(None)
    with pytest.raises(NotAuthenticated):
        Authenticate(uow).execute(first)
    assert Authenticate(uow).execute(second).email == "ana@team.dev"


def test_authenticate_rejects_missing_unknown_and_expired_sessions():
    uow = InMemoryUnitOfWork()
    token = _sign_up(uow).token
    for bad in (None, "", "not-a-token"):
        with pytest.raises(NotAuthenticated):
            Authenticate(uow).execute(bad)
    assert Authenticate(uow).optional(None) is None

    later = Authenticate(uow, lambda: NOW + timedelta(days=30))
    with pytest.raises(NotAuthenticated):
        later.execute(token)
    assert uow.sessions.get_by_digest(token_digest(token)) is None  # deleted when seen


def test_prune_sessions():
    uow = InMemoryUnitOfWork()
    _sign_up(uow)
    assert PruneSessions(uow.factory(), lambda: NOW + timedelta(days=31)).execute() == 1


def _profile(uow, account, bus=None, **fields):
    return asyncio.run(UpdateProfile(uow, bus or RecordingEventBus()).execute(account, ProfileUpdate(**fields)))


def test_update_profile_partially():
    uow = InMemoryUnitOfWork()
    account = _sign_up(uow).account
    updated = _profile(uow, account, role="Backend", seniority="senior", hours_per_week=30, skills=["Python", "SQL"])
    assert (updated.role, updated.seniority, updated.hours_per_week, updated.skills, updated.name) == ("Backend", "senior", 30, ["Python", "SQL"], "Ana Gómez")
    assert uow.accounts.get(account.id) == updated
    assert _profile(uow, updated, role=None).role is None  # null clears it

    with pytest.raises(ValidationFailed):
        _profile(uow, updated)
    with pytest.raises(ValidationFailed) as error:
        _profile(uow, updated, name=None, hours_per_week=0)
    assert [e.field for e in error.value.errors] == ["name"]


def test_a_new_name_renames_me_in_every_project_but_nothing_else_changes():
    uow = InMemoryUnitOfWork()
    account = _sign_up(uow).account
    p1 = uow.projects.add(Project(name="P1", description="d", members=[Member(name="Ana Gómez", role="Backend", account_id=account.id, permission="leader")]))
    p2 = uow.projects.add(
        Project(
            name="P2",
            description="d",
            members=[Member(name="Ana", role="QA", account_id=account.id), Member(name="Ana López", role="PM", permission="leader")],
        )
    )
    uow.commit()
    bus = RecordingEventBus()

    _profile(uow, account, bus, name="Ana López", role="Design")

    assert [m.name for m in uow.projects.get(p1.id).members] == ["Ana López"]
    assert [(m.name, m.role) for m in uow.projects.get(p2.id).members] == [("Ana López 2", "QA"), ("Ana López", "PM")]
    assert [(e.type, e.project_id) for e in bus.events] == [("team_changed", p1.id), ("team_changed", p2.id)]
    assert bus.events[0].changed[0].fields == ["name"]


def test_a_new_photo_follows_me_into_my_projects_without_a_team_change():
    uow = InMemoryUnitOfWork()
    account = _sign_up(uow).account
    project = uow.projects.add(
        Project(name="P1", description="d", members=[Member(name="Ana Gómez", role="Backend", account_id=account.id), Member(name="Leo", role="QA")])
    )
    uow.commit()
    bus = RecordingEventBus()

    updated = _profile(uow, account, bus, avatar_url=" /avatars/ana-gomez.jpg ")

    assert updated.avatar_url == "/avatars/ana-gomez.jpg"
    assert [m.avatar_url for m in uow.projects.get(project.id).members] == ["/avatars/ana-gomez.jpg", None]
    assert bus.events == []

    both = _profile(uow, updated, bus, avatar_url=None, name="Ana López")
    assert [(m.name, m.avatar_url) for m in uow.projects.get(project.id).members] == [("Ana López", None), ("Leo", None)]
    assert both.avatar_url is None
    assert [e.changed[0].fields for e in bus.events] == [["name"]]


@pytest.mark.parametrize("url", ["http://x.dev/a.jpg", "//evil.dev/a.jpg", "javascript:alert(1)", "https://x.dev/" + "a" * 500])
def test_a_photo_must_be_an_https_link_or_a_local_path(url):
    uow = InMemoryUnitOfWork()
    account = _sign_up(uow).account
    with pytest.raises(ValidationFailed) as error:
        _profile(uow, account, avatar_url=url)
    assert [e.field for e in error.value.errors] == ["avatar_url"]
