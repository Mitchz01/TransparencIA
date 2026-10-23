"""Spec 007 persistence: token and GitHub usernames, issue links, own writes."""

import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.persistence import tables, token_cipher
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.domain.board import Task
from app.domain.integrations import ExternalLink, OwnWrite
from app.domain.project import Member, Project


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _project(uow, **fields) -> Project:
    project = uow.projects.add(
        Project(name="Demo", description="Something", members=[Member(name="Ana", role="Backend", github_username="ana")], **fields)
    )
    uow.commit()
    return project


def test_token_webhook_and_username_roundtrip(session):
    with SqlUnitOfWork(session) as uow:
        saved = _project(uow, repository="acme/App", github_token="ghp_secret", webhook_id=7)
        member_id = saved.members[0].id

    with SqlUnitOfWork(session) as uow:
        loaded = uow.projects.get(saved.id)
        assert (loaded.github_token, loaded.webhook_id, loaded.has_token) == ("ghp_secret", 7, True)
        assert loaded.members[0].github_username == "ana"
        assert "github_token" not in loaded.model_dump() and "ghp_secret" not in loaded.model_dump_json()
        assert uow.projects.get_by_member(member_id).id == saved.id
        assert uow.projects.get_by_repository("ACME/app").id == saved.id
        assert uow.projects.get_by_repository("acme/other") is None
        assert uow.projects.get_by_member(999) is None


def test_token_is_encrypted_at_rest_with_a_secret_key():
    sealed = token_cipher.seal("ghp_secret", "my-key")
    assert sealed.startswith("fernet:") and "ghp_secret" not in sealed
    assert token_cipher.unseal(sealed, "my-key") == "ghp_secret"
    assert token_cipher.unseal(sealed, "other-key") is None  # wrong key: no usable token
    assert token_cipher.seal("ghp_plain", "") == "ghp_plain"  # no key: plain text
    assert token_cipher.unseal("ghp_plain", "my-key") == "ghp_plain"  # old plain rows still read


def test_links_by_task_project_and_number(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow, repository="acme/app")
        task = uow.tasks.add(Task(project_id=project.id, key="US-1", title="Login"))
        old = uow.links.add(
            ExternalLink(project_id=project.id, task_id=task.id, kind="issue", repository="acme/app", number=3, url="u3", broken=True)
        )
        new = uow.links.add(ExternalLink(project_id=project.id, task_id=task.id, kind="issue", repository="acme/app", number=9, url="u9"))
        pr = uow.links.add(
            ExternalLink(project_id=project.id, task_id=task.id, kind="pull_request", repository="acme/app", number=10, url="p10")
        )
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        assert uow.links.get_issue(task.id).id == new.id
        assert [link.id for link in uow.links.list_by_project(project.id)] == [old.id, new.id, pr.id]
        assert [link.id for link in uow.links.list_by_project(project.id, "pull_request")] == [pr.id]
        assert [link.id for link in uow.links.find("ACME/app", 9, "issue")] == [new.id]
        assert uow.links.find("acme/app", 10, "issue") == []
        uow.links.save(new.model_copy(update={"state": "closed"}))
        uow.commit()
        assert uow.links.get_issue(task.id).state == "closed"


def test_own_writes_are_consumed_once(session):
    with SqlUnitOfWork(session) as uow:
        uow.own_writes.add(OwnWrite(repository="acme/app", number=4, action="issue_closed"))
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        assert uow.own_writes.consume_matching("acme/app", 4, "issue_edited") is False
        assert uow.own_writes.consume_matching("Acme/App", 4, "issue_closed") is True
        assert uow.own_writes.consume_matching("acme/app", 4, "issue_closed") is False
        uow.commit()
    assert session.get(tables.OwnWriteTable, 1).consumed_at is not None
