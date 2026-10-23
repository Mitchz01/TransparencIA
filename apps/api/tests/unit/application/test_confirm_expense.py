"""Spec 017, US2: confirming an expense draft adds the rule alerts and makes it count (FR-005, FR-006)."""

import datetime as dt

import pytest

from app.application.use_cases.transparency.confirm_expense import ConfirmExpense
from app.domain.board import Task
from app.domain.errors import ProjectNotFound, ValidationFailed
from app.domain.transparency import (
    Alert,
    Budget,
    BudgetLine,
    BudgetMissing,
    Expense,
    ExpenseConfirmation,
    ExpenseNotDraft,
    ExpenseNotFound,
)
from tests.fakes import InMemoryUnitOfWork, project


def _setup(budget: bool = True):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(duration_weeks=26))
    task = uow.tasks.add(Task(project_id=saved.id, key="T-1", title="Comprar plántulas"))
    if budget:
        uow.budgets.save(
            Budget(
                project_id=saved.id,
                contracting_entity="Corpamag",
                contractor="Fundación Manglares Vivos",
                contract_value=180_000_000,
                start_date=dt.date(2026, 8, 3),
                lines=[BudgetLine(id="R1", name="Plántulas de mangle", amount=45_000_000)],
            )
        )
    draft = uow.expenses.add(
        Expense(
            project_id=saved.id, file_id=1, mime="image/jpeg", kind="invoice", amount=2_400_000,
            alerts=[Alert(level="medium", reason="El concepto no corresponde al rubro.", source="ai")],
        )
    )
    uow.commit()
    return uow, saved, task, draft


def _confirmation(**overrides) -> ExpenseConfirmation:
    data = {
        "kind": "invoice", "amount": 30_000_000, "date": dt.date(2026, 8, 20), "supplier": "Vivero Ciénaga Viva",
        "concept": "20.000 plántulas", "budget_line_id": "R1", "task_id": None, "citizen_summary": "  Se compraron plántulas.  ",
    }
    return ExpenseConfirmation(**{**data, **overrides})


def test_confirming_saves_the_fields_and_keeps_the_ai_alerts():
    uow, saved, task, draft = _setup()

    result = ConfirmExpense(uow).execute(saved.id, draft.id, _confirmation(task_id=task.id))

    assert (result.status, result.amount, result.task_title, result.citizen_summary) == (
        "confirmed", 30_000_000, "Comprar plántulas", "Se compraron plántulas.",
    )
    assert [(a.source, a.level) for a in result.alerts] == [("ai", "medium")]
    assert all(a.id is not None and a.expense_id == draft.id for a in result.alerts)
    uow.rollback()  # it was committed
    assert uow.expenses.get(draft.id).status == "confirmed"


def test_rule_alerts_are_added_on_confirming():
    uow, saved, _, draft = _setup()
    uow.expenses.add(Expense(project_id=saved.id, file_id=2, mime="application/pdf", kind="invoice", status="confirmed", amount=44_000_000, budget_line_id="R1"))
    uow.commit()

    result = ConfirmExpense(uow).execute(saved.id, draft.id, _confirmation(amount=3_000_000, date=dt.date(2027, 3, 1)))

    assert [(a.source, a.level) for a in result.alerts] == [("ai", "medium"), ("rule", "high"), ("rule", "medium")]
    assert result.alerts[1].reason == "El gasto de $3.000.000 supera lo disponible en el rubro Plántulas de mangle ($1.000.000)"


def test_a_confirmed_expense_cant_be_confirmed_again():
    uow, saved, _, draft = _setup()
    ConfirmExpense(uow).execute(saved.id, draft.id, _confirmation())

    with pytest.raises(ExpenseNotDraft):
        ConfirmExpense(uow).execute(saved.id, draft.id, _confirmation())


def test_unknown_ids_and_other_projects():
    uow, saved, _, draft = _setup()
    other = uow.projects.add(project(name="Otro"))
    uow.commit()

    with pytest.raises(ProjectNotFound):
        ConfirmExpense(uow).execute(999, draft.id, _confirmation())
    with pytest.raises(ExpenseNotFound):
        ConfirmExpense(uow).execute(saved.id, 999, _confirmation())
    with pytest.raises(ExpenseNotFound):
        ConfirmExpense(uow).execute(other.id, draft.id, _confirmation())


def test_without_a_budget():
    uow, saved, _, draft = _setup(budget=False)

    with pytest.raises(BudgetMissing):
        ConfirmExpense(uow).execute(saved.id, draft.id, _confirmation())


def test_invalid_fields_save_nothing():
    uow, saved, _, draft = _setup()

    with pytest.raises(ValidationFailed) as error:
        ConfirmExpense(uow).execute(saved.id, draft.id, _confirmation(budget_line_id="R9", task_id=999, citizen_summary=" "))

    assert [e.field for e in error.value.errors] == ["budget_line_id", "task_id", "citizen_summary"]
    uow.rollback()
    assert uow.expenses.get(draft.id).status == "draft"
