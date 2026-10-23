"""/api/projects (spec 001; GET /plan is spec 004)."""

from fastapi import APIRouter, Depends, Response, status

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import ProjectCreate, ProjectSummary, ProjectUpdate
from app.application.use_cases.projects.create_project import CreateProject
from app.application.use_cases.projects.get_project import GetProject
from app.application.use_cases.projects.list_projects import ListProjects
from app.application.use_cases.projects.update_project import UpdateProject
from app.domain.project import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Project)
def create_project(
    body: ProjectCreate, response: Response, use_case: CreateProject = Depends(deps.get_create_project)
) -> Project:
    project = use_case.execute(body)
    response.headers["Location"] = f"/api/projects/{project.id}"
    return project


@router.get("", response_model=list[ProjectSummary])
def list_projects(use_case: ListProjects = Depends(deps.get_list_projects)) -> list[ProjectSummary]:
    return use_case.execute()


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: int, use_case: GetProject = Depends(deps.get_get_project)) -> Project:
    return use_case.execute(project_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: int, body: ProjectUpdate, use_case: UpdateProject = Depends(deps.get_update_project)
) -> Project:
    return await use_case.execute(project_id, body)
