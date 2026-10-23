"""/api/projects (spec 001; GET /plan is spec 004; accounts and permissions from spec 015)."""

from fastapi import APIRouter, Depends, Response, status

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import ProjectCreate, ProjectSummary, ProjectUpdate
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_plan_views import GetPlanViews
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.application.use_cases.projects.update_project import UpdateProject
from app.domain.accounts import Account
from app.domain.plan_views import PlanViews
from app.domain.project import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Project)
def create_project(
    body: ProjectCreate,
    response: Response,
    account: Account = Depends(deps.current_account),
    use_case: CreateProject = Depends(deps.get_create_project),
) -> Project:
    project = use_case.execute(body, account)
    response.headers["Location"] = f"/api/projects/{project.id}"
    return project


@router.get("", response_model=list[ProjectSummary])
def list_projects(
    account: Account = Depends(deps.current_account), use_case: ListProjects = Depends(deps.get_list_projects)
) -> list[ProjectSummary]:
    return use_case.execute(account)


@router.get("/{project_id}", response_model=Project, dependencies=[Depends(deps.allow("view"))])
def get_project(project_id: int, use_case: GetProject = Depends(deps.get_get_project)) -> Project:
    return use_case.execute(project_id)


@router.patch("/{project_id}", response_model=Project, dependencies=[Depends(deps.allow("manage"))])
def update_project(project_id: int, body: ProjectUpdate, use_case: UpdateProject = Depends(deps.get_update_project)) -> Project:
    return use_case.execute(project_id, body)


@router.get("/{project_id}/plan", response_model=PlanViews, dependencies=[Depends(deps.allow("view"))])
def get_plan_views(project_id: int, use_case: GetPlanViews = Depends(deps.get_plan_views)) -> PlanViews:
    """Spec 004: the three plan views in one request; never writes anything."""
    return use_case.execute(project_id)
