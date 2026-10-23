"""/api/projects/{id}/budget, /expenses, /transparency, /publication, /alerts and /api/files/{id}
(spec 017, plan.md "API Contract"). Owner: P3."""

import datetime as dt

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from pydantic import BaseModel

from app.adapters.inbound.http import dependencies as deps
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.transparency.answer_alert import AnswerAlert
from app.application.use_cases.transparency.confirm_expense import ConfirmExpense
from app.application.use_cases.transparency.discard_expense import DiscardExpense
from app.application.use_cases.transparency.draft_expense import DraftExpense
from app.application.use_cases.transparency.get_budget import GetBudget
from app.application.use_cases.transparency.get_file import GetFile
from app.application.use_cases.transparency.get_portal import GetPortal
from app.application.use_cases.transparency.set_budget import SetBudget
from app.application.use_cases.transparency.set_publication import SetPublication
from app.domain.accounts import Account
from app.domain.transparency import (
    UPLOAD_MAX_BYTES,
    Alert,
    Budget,
    BudgetLine,
    Expense,
    ExpenseConfirmation,
    Portal,
    TeamPortal,
    UnsupportedFile,
    end_date,
)

router = APIRouter(prefix="/api", tags=["transparency"])


# ---------- Views: the domain shapes plus what only the HTTP contract has ----------


class ExpenseView(Expense):
    file_url: str


class PortalView(Portal):
    expenses: list[ExpenseView]  # type: ignore[assignment]


class TeamPortalView(PortalView):
    drafts: list[ExpenseView]
    public: bool


class BudgetInput(BaseModel):
    """PUT body: the budget without the computed end date."""

    contracting_entity: str
    contractor: str
    contract_value: int
    start_date: dt.date
    lines: list[BudgetLine] = []


class BudgetView(BaseModel):
    contracting_entity: str
    contractor: str
    contract_value: int
    start_date: dt.date
    end_date: dt.date
    lines: list[BudgetLine]


class PublicationInput(BaseModel):
    public: bool


class PublicationView(BaseModel):
    public: bool
    public_url: str | None


class AnswerInput(BaseModel):
    answer: str


def expense_view(expense: Expense) -> ExpenseView:
    return ExpenseView.model_validate({**expense.model_dump(), "file_url": f"/api/files/{expense.file_id}"})


def portal_view(portal: Portal) -> PortalView:
    return PortalView.model_validate({**portal.model_dump(), "expenses": [expense_view(e).model_dump() for e in portal.expenses]})


def team_portal_view(portal: TeamPortal) -> TeamPortalView:
    data = portal.model_dump()
    data["expenses"] = [expense_view(e).model_dump() for e in portal.expenses]
    data["drafts"] = [expense_view(e).model_dump() for e in portal.drafts]
    return TeamPortalView.model_validate(data)


def _budget_view(budget: Budget, duration_weeks: int) -> BudgetView:
    return BudgetView(
        contracting_entity=budget.contracting_entity,
        contractor=budget.contractor,
        contract_value=budget.contract_value,
        start_date=budget.start_date,
        end_date=end_date(budget, duration_weeks),
        lines=budget.lines,
    )


# ---------- Budget (US1) ----------


@router.get("/projects/{project_id}/budget", response_model=BudgetView | None, dependencies=[Depends(deps.allow("view"))])
def get_budget(
    project_id: int,
    use_case: GetBudget = Depends(deps.get_get_budget),
    project: GetProject = Depends(deps.get_get_project),
) -> BudgetView | None:
    budget = use_case.execute(project_id)
    return _budget_view(budget, project.execute(project_id).duration_weeks) if budget else None


@router.put("/projects/{project_id}/budget", response_model=BudgetView, dependencies=[Depends(deps.allow("manage"))])
def set_budget(
    project_id: int,
    body: BudgetInput,
    use_case: SetBudget = Depends(deps.get_set_budget),
    project: GetProject = Depends(deps.get_get_project),
) -> BudgetView:
    budget = use_case.execute(project_id, Budget(project_id=project_id, **body.model_dump()))
    return _budget_view(budget, project.execute(project_id).duration_weeks)


# ---------- Evidence and expenses (US2) ----------


@router.post(
    "/projects/{project_id}/expenses",
    status_code=status.HTTP_201_CREATED,
    response_model=ExpenseView,
    dependencies=[Depends(deps.allow("work"))],
)
async def draft_expense(
    project_id: int,
    file: UploadFile | None = File(None),
    use_case: DraftExpense = Depends(deps.get_draft_expense),
) -> ExpenseView:
    if file is None:
        raise UnsupportedFile()
    data = await file.read(UPLOAD_MAX_BYTES + 1)  # one byte over the limit is enough to reject it
    return expense_view(await use_case.execute(project_id, file.filename or "evidence", file.content_type or "", data))


@router.post(
    "/projects/{project_id}/expenses/{expense_id}/confirm",
    response_model=ExpenseView,
    dependencies=[Depends(deps.allow("work"))],
)
def confirm_expense(
    project_id: int,
    expense_id: int,
    body: ExpenseConfirmation,
    use_case: ConfirmExpense = Depends(deps.get_confirm_expense),
) -> ExpenseView:
    return expense_view(use_case.execute(project_id, expense_id, body))


@router.delete(
    "/projects/{project_id}/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(deps.allow("work"))],
)
def discard_expense(
    project_id: int, expense_id: int, use_case: DiscardExpense = Depends(deps.get_discard_expense)
) -> Response:
    use_case.execute(project_id, expense_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- The team's view, publication and answers (US3, US5) ----------


@router.get("/projects/{project_id}/transparency", response_model=TeamPortalView, dependencies=[Depends(deps.allow("view"))])
def get_team_portal(project_id: int, use_case: GetPortal = Depends(deps.get_get_portal)) -> TeamPortalView:
    return team_portal_view(use_case.for_team(project_id))


@router.put("/projects/{project_id}/publication", response_model=PublicationView, dependencies=[Depends(deps.allow("manage"))])
def set_publication(
    project_id: int, body: PublicationInput, use_case: SetPublication = Depends(deps.get_set_publication)
) -> PublicationView:
    public, public_url = use_case.execute(project_id, body.public)
    return PublicationView(public=public, public_url=public_url)


@router.post(
    "/projects/{project_id}/alerts/{alert_id}/answer",
    response_model=Alert,
    dependencies=[Depends(deps.allow("manage"))],
)
def answer_alert(
    project_id: int, alert_id: int, body: AnswerInput, use_case: AnswerAlert = Depends(deps.get_answer_alert)
) -> Alert:
    return use_case.execute(project_id, alert_id, body.answer)


# ---------- Files (US2, US3) ----------


@router.get("/files/{file_id}")
def get_file(
    file_id: int,
    account: Account | None = Depends(deps.optional_account),
    use_case: GetFile = Depends(deps.get_get_file),
) -> Response:
    file = use_case.execute(file_id, account.id if account else None)
    return Response(content=file.data, media_type=file.mime, headers={"X-Content-Type-Options": "nosniff"})
