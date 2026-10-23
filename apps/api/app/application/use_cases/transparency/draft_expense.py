"""Read an uploaded piece of evidence into an expense draft with the AI's alerts (spec 017, US2).
The file and the draft are only saved if the agent succeeds. Owner: P3."""

from typing import Any

from app.application.ports.transparency_agents import TransparencyAgents
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import DomainError, ProjectNotFound
from app.domain.transparency import (
    UPLOAD_MAX_BYTES,
    UPLOAD_MIMES,
    AgentUnavailable,
    Alert,
    BudgetMissing,
    Expense,
    StoredFile,
    UnsupportedFile,
    end_date,
)


class DraftExpense:
    def __init__(self, uow: UnitOfWork, agents: TransparencyAgents):
        self._uow = uow
        self._agents = agents

    async def execute(self, project_id: int, filename: str, mime: str, data: bytes) -> Expense:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        mime = (mime or "").split(";")[0].strip().lower()
        if mime not in UPLOAD_MIMES or not data or len(data) > UPLOAD_MAX_BYTES:
            raise UnsupportedFile()
        budget = self._uow.budgets.get(project_id)
        if budget is None:
            raise BudgetMissing(project_id)

        sprints = {s.id: s.name for s in self._uow.sprints.list_by_project(project_id)}
        tasks = self._uow.tasks.list_by_project(project_id)
        context: dict[str, Any] = {
            "budget": budget,
            "contract_period": {"start": budget.start_date, "end": end_date(budget, project.duration_weeks)},
            "tasks": [{"id": t.id, "title": t.title, "sprint": sprints.get(t.sprint_id)} for t in tasks if t.id is not None],
        }
        try:
            reading = await self._agents.read_evidence(context, data, mime, filename)
        except DomainError:
            raise
        except Exception as error:  # the port promises AgentUnavailable; anything else is the same to the member
            raise AgentUnavailable() from error

        alerts = [Alert(level=a.level, reason=a.reason, source="ai") for a in reading.alerts]
        line_id = reading.budget_line_id
        if line_id is not None and line_id not in {line.id for line in budget.lines}:
            line_id = None
            alerts.append(Alert(level="low", reason="No pudimos asignar el gasto a un rubro del presupuesto; asígnalo antes de confirmar.", source="ai"))
        task = next((t for t in tasks if t.id == reading.task_id), None) if reading.task_id is not None else None
        if reading.task_id is not None and task is None:
            alerts.append(Alert(level="low", reason="No pudimos asignar la evidencia a una tarea del tablero; asígnala antes de confirmar.", source="ai"))

        stored = self._uow.files.add(StoredFile(project_id=project_id, name=filename, mime=mime, data=data))
        draft = Expense(
            project_id=project_id,
            file_id=stored.id,  # type: ignore[arg-type]
            mime=mime,
            kind=reading.kind,
            amount=reading.amount,
            date=reading.date,
            supplier=reading.supplier,
            concept=reading.concept,
            budget_line_id=line_id,
            task_id=task.id if task else None,
            task_title=task.title if task else None,
            citizen_summary=reading.citizen_summary,
            alerts=alerts,
        )
        saved = self._uow.expenses.add(draft)
        self._uow.commit()
        return saved
