"""/api/public/projects: the search (US8, P5), the portal and the citizen chat, no session (spec 017, US3 and US4). Owner: P3."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.transparency import PortalView, portal_view
from app.application.use_cases.transparency.ask_citizen import AskCitizen
from app.application.use_cases.transparency.get_portal import GetPortal
from app.application.use_cases.transparency.search_public_projects import QUERY_MAX, PublicProjectCard, SearchPublicProjects
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import QUESTION_MAX, CitizenAnswer

router = APIRouter(prefix="/api/public", tags=["public"])


class QuestionInput(BaseModel):
    question: str = Field(min_length=1, max_length=QUESTION_MAX)


def get_search_public_projects(
    uow: UnitOfWork = Depends(deps.get_uow), portal: GetPortal = Depends(deps.get_get_portal)
) -> SearchPublicProjects:
    return SearchPublicProjects(uow, portal)


@router.get("/projects", response_model=list[PublicProjectCard])
def search_public_projects(
    q: str = Query("", max_length=QUERY_MAX), use_case: SearchPublicProjects = Depends(get_search_public_projects)
) -> list[PublicProjectCard]:
    return use_case.execute(q)


@router.get("/projects/{slug}", response_model=PortalView)
def get_public_portal(slug: str, use_case: GetPortal = Depends(deps.get_get_portal)) -> PortalView:
    return portal_view(use_case.for_public(slug))


@router.post("/projects/{slug}/ask", response_model=CitizenAnswer)
async def ask_citizen(slug: str, body: QuestionInput, use_case: AskCitizen = Depends(deps.get_ask_citizen)) -> CitizenAnswer:
    return await use_case.execute(slug, body.question)
