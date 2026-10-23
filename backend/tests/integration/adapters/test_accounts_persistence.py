"""Spec 015: accounts, sessions, linked members and invitation tokens in SQLite, and the scrypt hasher."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.persistence import db
from app.adapters.outbound.persistence import tables  # noqa: F401
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.adapters.outbound.security.password_hasher import ScryptPasswordHasher
from app.domain.accounts import Account, new_session
from app.domain.project import Member, Project

NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_account_roundtrip_keeps_the_hash_out_of_dumps(session):
    with SqlUnitOfWork(session) as uow:
        saved = uow.accounts.add(Account(email="ana@team.dev", name="Ana", role="Backend", skills=["SQL"], password_hash="h", created_at=NOW))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        loaded = uow.accounts.get_by_email("ana@team.dev")
        assert loaded == saved and loaded.password_hash == "h" and loaded.created_at == NOW
        assert uow.accounts.get_by_email("leo@team.dev") is None
        uow.accounts.save(loaded.model_copy(update={"role": "QA"}))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert uow.accounts.get(saved.id).role == "QA" and uow.accounts.get(saved.id).password_hash == "h"


def test_sessions_by_digest_delete_and_prune(session):
    with SqlUnitOfWork(session) as uow:
        account = uow.accounts.add(Account(email="ana@team.dev", name="Ana", password_hash="h"))
        old = uow.sessions.add(new_session(account.id, "a" * 64, NOW - timedelta(days=40)))
        kept = uow.sessions.add(new_session(account.id, "b" * 64, NOW))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert uow.sessions.get_by_digest("b" * 64) == kept
        assert uow.sessions.prune_expired(NOW) == 1
        assert uow.sessions.get_by_digest(old.token_digest) is None
        uow.sessions.delete(kept.id)
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert uow.sessions.get_by_digest("b" * 64) is None


def test_projects_by_account_and_invite_token(session):
    with SqlUnitOfWork(session) as uow:
        ana = uow.accounts.add(Account(email="ana@team.dev", name="Ana", password_hash="h"))
        leo = uow.accounts.add(Account(email="leo@team.dev", name="Leo", password_hash="h"))
        mine = uow.projects.add(
            Project(
                name="Mine",
                description="d",
                invite_token="tok",
                members=[Member(name="Ana", role="B", account_id=ana.id, permission="leader"), Member(name="Leo", role="F", account_id=leo.id)],
            )
        )
        uow.projects.add(Project(name="Other", description="d", members=[Member(name="Leo", role="F", account_id=leo.id, permission="leader")]))
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        assert [p.name for p in uow.projects.list_by_account(ana.id)] == ["Mine"]
        assert [p.name for p in uow.projects.list_by_account(leo.id)] == ["Mine", "Other"]
        found = uow.projects.get_by_invite_token("tok")
        assert found.id == mine.id and found.invite_token == "tok" and "invite_token" not in found.model_dump()
        assert [(m.account_id, m.permission) for m in found.members] == [(ana.id, "leader"), (leo.id, "member")]
        assert uow.projects.get_by_invite_token("nope") is None

        # Leo leaves "Mine": deactivated members don't count
        uow.projects.save(found.model_copy(update={"members": found.members[:1], "invite_token": None}))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert [p.name for p in uow.projects.list_by_account(leo.id)] == ["Other"]
        assert uow.projects.get_by_invite_token("tok") is None


def test_scrypt_hasher():
    hasher = ScryptPasswordHasher(n=2**10)
    hashed = hasher.hash("secret-123")
    assert hashed.startswith("scrypt$1024$8$1$") and "secret-123" not in hashed
    assert hashed != hasher.hash("secret-123")  # salted
    assert hasher.verify("secret-123", hashed) and not hasher.verify("secret-124", hashed)
    assert not hasher.verify("secret-123", "garbage") and not hasher.verify("secret-123", "bcrypt$1$2$3$4$5")
    assert ScryptPasswordHasher().verify("secret-123", hashed)  # the cost travels with the hash


def test_an_old_database_is_detected(monkeypatch):
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE member (id INTEGER PRIMARY KEY, project_id INTEGER, name TEXT)"))
    monkeypatch.setattr(db, "engine", engine)
    with pytest.raises(db.OutdatedDatabase):
        db.create_db()
