import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.persistence import tables  # noqa: F401
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.domain.board import ChecklistItem, Task
from app.domain.project import Member, Project


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_project_roundtrip_with_team(session):
    with SqlUnitOfWork(session) as uow:
        saved = uow.projects.add(
            Project(
                name="Demo",
                description="Something",
                auto_approve=True,
                members=[Member(name="Ana", role="Backend"), Member(name="Leo", role="Frontend")],
            )
        )
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        loaded = uow.projects.get(saved.id)

    assert loaded is not None
    assert loaded.auto_approve
    assert [m.name for m in loaded.members] == ["Ana", "Leo"]


def test_task_checklist_is_persisted(session):
    with SqlUnitOfWork(session) as uow:
        project = uow.projects.add(Project(name="Demo", description="Something"))
        task = uow.tasks.add(
            Task(project_id=project.id, key="US-1", title="Login", checklist=[ChecklistItem(text="Form")])
        )
        task.checklist[0].done = True
        task.status = "done"
        uow.tasks.save(task)
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        loaded = uow.tasks.get(task.id)

    assert loaded.status == "done"
    assert loaded.checklist == [ChecklistItem(text="Form", done=True)]


def test_without_commit_nothing_is_saved(session):
    with SqlUnitOfWork(session) as uow:
        uow.projects.add(Project(name="Demo", description="Something"))

    with SqlUnitOfWork(session) as uow:
        assert uow.projects.list() == []


def test_save_syncs_the_team_and_deactivates_removed_members(session):
    from app.adapters.outbound.persistence.tables import MemberTable

    with SqlUnitOfWork(session) as uow:
        saved = uow.projects.add(
            Project(name="Demo", description="Algo", members=[Member(name="Ana", role="Backend"), Member(name="Leo", role="Frontend")])
        )
        uow.commit()

    ana, leo = saved.members
    edited = saved.model_copy(
        update={"members": [ana.model_copy(update={"hours_per_week": 30}), Member(name="Sofía", role="QA")]}
    )
    with SqlUnitOfWork(session) as uow:
        uow.projects.save(edited)
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        loaded = uow.projects.get(saved.id)
    assert [(m.name, m.hours_per_week) for m in loaded.members] == [("Ana", 30), ("Sofía", 20)]
    # Leo is kept as an inactive row, so his done tasks still point to him.
    leo_row = session.get(MemberTable, leo.id)
    assert leo_row is not None and leo_row.active is False


def test_dates_come_back_in_utc(session):
    with SqlUnitOfWork(session) as uow:
        saved = uow.projects.add(Project(name="Demo", description="Algo"))
        uow.commit()
    session.expire_all()
    with SqlUnitOfWork(session) as uow:
        assert uow.projects.get(saved.id).created_at.tzinfo is not None
