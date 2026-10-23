import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.persistence import tables  # noqa: F401
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.domain.board import ChecklistItem, Objective, Sprint, Task
from app.domain.documents import Document, DocumentVersion
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


def test_board_entities_roundtrip(session):
    with SqlUnitOfWork(session) as uow:
        project = uow.projects.add(Project(name="Demo", description="Something", sprint_capacity_override=20))
        sprint = uow.sprints.add(Sprint(project_id=project.id, number=1, name="Sprint 1", goal="Base"))
        objective = uow.objectives.add(Objective(project_id=project.id, sprint_id=sprint.id, title="Base"))
        task = uow.tasks.add(Task(project_id=project.id, sprint_id=sprint.id, key="US-1", title="Login", missing_role="UX"))
        uow.sprints.save(sprint.model_copy(update={"goal": "Base ready"}))
        uow.objectives.save(objective.model_copy(update={"done": True}))
        uow.commit()

    with SqlUnitOfWork(session) as uow:
        assert uow.projects.get(project.id).sprint_capacity_override == 20
        assert uow.sprints.get(sprint.id).goal == "Base ready"
        assert uow.sprints.get(999) is None
        assert uow.objectives.list_by_project(project.id) == [objective.model_copy(update={"done": True})]
        assert uow.tasks.get(task.id).missing_role == "UX"


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


def test_documents_and_their_versions_roundtrip(session):
    with SqlUnitOfWork(session) as uow:
        project = uow.projects.add(Project(name="Demo", description="Something"))
        doc = uow.documents.add(
            Document(project_id=project.id, key="epic_spec:EP-2", kind="epic_spec", epic_key="EP-2", title="Team", content="# v1")
        )
        uow.documents.add_version(DocumentVersion(document_id=doc.id, version=1, content="# v1"))
        uow.documents.save(doc.next_version("Team", "# v2"))
        uow.documents.add_version(DocumentVersion(document_id=doc.id, version=2, content="# v2", source="leader"))
        uow.commit()
    session.expire_all()

    with SqlUnitOfWork(session) as uow:
        found = uow.documents.find(project.id, "epic_spec:EP-2")
        versions = uow.documents.versions(doc.id)
        assert uow.documents.find(project.id, "general_spec") is None
        assert [d.id for d in uow.documents.list_by_project(project.id)] == [doc.id]

    assert found is not None and found.version == 2 and found.content == "# v2"
    assert found.updated_at.tzinfo is not None
    assert [(v.version, v.content, v.source) for v in versions] == [(1, "# v1", "agent"), (2, "# v2", "leader")]
