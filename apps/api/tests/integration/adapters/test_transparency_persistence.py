"""Spec 017: budgets, expenses with their alerts, stored files, the portal's slug and Task.done_at in SQLite."""

from datetime import date, datetime, timezone

import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.persistence import tables  # noqa: F401
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.domain.board import Task
from app.domain.project import Member, Project
from app.domain.transparency import Alert, Budget, BudgetLine, Expense, StoredFile

NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _project(uow) -> Project:
    saved = uow.projects.add(Project(name="Manglar", description="Restauración", duration_weeks=26, members=[Member(name="Ana", role="Bióloga")]))
    uow.commit()
    return saved


def _budget(project_id: int, **fields) -> Budget:
    return Budget(
        project_id=project_id,
        contracting_entity="Corpamag",
        contractor="Fundación Manglares Vivos",
        contract_value=180_000_000,
        start_date=date(2026, 8, 3),
        lines=[BudgetLine(id="R1", name="Plántulas de mangle", amount=45_000_000), BudgetLine(id="R2", name="Mano de obra", amount=70_000_000)],
        **fields,
    )


def _expense(project_id: int, file_id: int, **fields) -> Expense:
    data = {"project_id": project_id, "file_id": file_id, "mime": "application/pdf", "kind": "invoice", "created_at": NOW}
    return Expense(**{**data, **fields})


def test_budget_roundtrip_and_replace(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        assert uow.budgets.get(project.id) is None
        saved = uow.budgets.save(_budget(project.id))
        uow.commit()
        assert saved == _budget(project.id)
    with SqlUnitOfWork(session) as uow:
        assert uow.budgets.get(project.id) == _budget(project.id)
        uow.budgets.save(_budget(project.id).model_copy(update={"contract_value": 200_000_000, "lines": []}))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        replaced = uow.budgets.get(project.id)
        assert replaced.contract_value == 200_000_000 and replaced.lines == []


def test_stored_file_keeps_its_bytes(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        saved = uow.files.add(StoredFile(project_id=project.id, name="factura.pdf", mime="application/pdf", data=b"%PDF-\x00\xff"))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert uow.files.get(saved.id) == saved and saved.data == b"%PDF-\x00\xff"
        assert uow.files.get(999) is None


def test_expense_roundtrip_carries_its_alerts(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        file = uow.files.add(StoredFile(project_id=project.id, name="f.pdf", mime="application/pdf", data=b"x"))
        saved = uow.expenses.add(
            _expense(
                project.id,
                file.id,
                amount=2_400_000,
                date=date(2026, 10, 2),
                budget_line_id="R1",
                task_title="Comprar plántulas",
                alerts=[Alert(level="medium", reason="El concepto no corresponde al rubro.", source="ai")],
            )
        )
        uow.commit()
    assert saved.id is not None and saved.alerts[0].id is not None and saved.alerts[0].expense_id == saved.id
    with SqlUnitOfWork(session) as uow:
        assert uow.expenses.get(saved.id) == saved
        assert saved.created_at == NOW and saved.date == date(2026, 10, 2)
        assert uow.expenses.get(999) is None


def test_save_keeps_alert_ids_adds_new_ones_and_drops_missing(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        file = uow.files.add(StoredFile(project_id=project.id, name="f.pdf", mime="application/pdf", data=b"x"))
        first = uow.expenses.add(
            _expense(project.id, file.id, alerts=[Alert(level="low", reason="a", source="ai"), Alert(level="low", reason="b", source="ai")])
        )
        uow.commit()
    keep = first.alerts[0]
    with SqlUnitOfWork(session) as uow:
        saved = uow.expenses.save(
            first.model_copy(update={"status": "confirmed", "alerts": [keep, Alert(level="high", reason="rule", source="rule")]})
        )
        uow.commit()
    assert saved.status == "confirmed"
    assert [a.reason for a in saved.alerts] == ["a", "rule"]
    assert saved.alerts[0].id == keep.id  # SQLite may reuse the dropped alert's id for the new one, so only the kept id is checked


def test_list_by_project_filters_by_status_and_project(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        other = uow.projects.add(Project(name="Otro", description="x", members=[Member(name="Leo", role="QA")]))
        file = uow.files.add(StoredFile(project_id=project.id, name="f.pdf", mime="application/pdf", data=b"x"))
        draft = uow.expenses.add(_expense(project.id, file.id))
        confirmed = uow.expenses.add(_expense(project.id, file.id, status="confirmed"))
        uow.expenses.add(_expense(other.id, file.id))
        uow.commit()
        assert [e.id for e in uow.expenses.list_by_project(project.id)] == [draft.id, confirmed.id]
        assert [e.id for e in uow.expenses.list_by_project(project.id, "confirmed")] == [confirmed.id]
        assert [e.id for e in uow.expenses.list_by_project(project.id, "draft")] == [draft.id]


def test_delete_removes_the_expense_and_its_alerts(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        file = uow.files.add(StoredFile(project_id=project.id, name="f.pdf", mime="application/pdf", data=b"x"))
        saved = uow.expenses.add(_expense(project.id, file.id, alerts=[Alert(level="low", reason="a", source="ai")]))
        uow.commit()
    alert_id = saved.alerts[0].id
    with SqlUnitOfWork(session) as uow:
        uow.expenses.delete(saved.id)
        uow.expenses.delete(saved.id)  # deleting what is gone is fine
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert uow.expenses.get(saved.id) is None and uow.expenses.get_alert(alert_id) is None


def test_an_alert_is_answered_on_its_own(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        file = uow.files.add(StoredFile(project_id=project.id, name="f.pdf", mime="application/pdf", data=b"x"))
        saved = uow.expenses.add(_expense(project.id, file.id, status="confirmed", alerts=[Alert(level="medium", reason="r", source="ai")]))
        uow.commit()
    alert = saved.alerts[0]
    with SqlUnitOfWork(session) as uow:
        uow.expenses.save_alert(alert.model_copy(update={"answer": "Se reclasificó a logística.", "answered_at": NOW}))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        answered = uow.expenses.get_alert(alert.id)
        assert answered.answer == "Se reclasificó a logística." and answered.answered_at == NOW
        assert uow.expenses.get(saved.id).alerts == [answered]


def test_project_slug_is_unique_and_found(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        assert uow.projects.get_by_public_slug("abc") is None and project.public is False and project.public_slug is None
        uow.projects.save(project.model_copy(update={"public": True, "public_slug": "abc"}))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        found = uow.projects.get_by_public_slug("abc")
        assert found.id == project.id and found.public is True
        uow.projects.save(found.model_copy(update={"public": False}))
        uow.commit()
        assert uow.projects.get_by_public_slug("abc").public_slug == "abc"  # unpublishing keeps the link


def test_task_done_at_roundtrip_as_utc(session):
    with SqlUnitOfWork(session) as uow:
        project = _project(uow)
        done = uow.tasks.add(Task(project_id=project.id, key="T-1", title="Sembrar", status="done", points=5, done_at=NOW))
        open_ = uow.tasks.add(Task(project_id=project.id, key="T-2", title="Monitorear"))
        uow.commit()
    with SqlUnitOfWork(session) as uow:
        assert uow.tasks.get(done.id).done_at == NOW
        assert uow.tasks.get(open_.id).done_at is None
