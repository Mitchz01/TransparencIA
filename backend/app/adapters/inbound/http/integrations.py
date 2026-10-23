"""GitHub integration endpoints (spec 007): repository, issues and GitHub usernames.
The github_action proposals they create are decided through spec 005's proposal API."""

from fastapi import APIRouter, Depends, Response, status

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import Connection, IssuesProposed, RepositoryConnect
from app.application.use_cases.integrations.connect_repository import ConnectRepository
from app.application.use_cases.integrations.disconnect_repository import DisconnectRepository
from app.application.use_cases.integrations.propose_issues import ProposeIssues

router = APIRouter(prefix="/api", tags=["integrations"])


@router.put("/projects/{project_id}/repository", response_model=Connection)
async def connect_repository(
    project_id: int, body: RepositoryConnect, use_case: ConnectRepository = Depends(deps.get_connect_repository)
) -> Connection:
    return await use_case.execute(project_id, body.repository, body.token)


@router.delete("/projects/{project_id}/repository", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_repository(
    project_id: int, use_case: DisconnectRepository = Depends(deps.get_disconnect_repository)
) -> Response:
    await use_case.execute(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/projects/{project_id}/issues/propose", status_code=status.HTTP_201_CREATED, response_model=IssuesProposed)
async def propose_issues(
    project_id: int, response: Response, use_case: ProposeIssues = Depends(deps.get_propose_issues)
) -> IssuesProposed:
    """The "Publish pending tasks" action: a create_issues proposal with every task without an issue."""
    proposal = await use_case.execute(project_id)
    response.headers["Location"] = f"/api/proposals/{proposal.id}"
    return IssuesProposed(proposal_id=proposal.id or 0, task_count=len(proposal.content["tasks"]))
