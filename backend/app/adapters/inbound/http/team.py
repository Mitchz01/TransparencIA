"""A project's team and its invitation link (spec 015, US4 and US6)."""

from fastapi import APIRouter, Body, Depends, Response, status

from app.adapters.inbound.http import dependencies as deps
from app.application.dto import Invitation, InvitationPreview, JoinRequest, JoinResult, MemberUpdate
from app.application.use_cases.projects.invitation import (
    DisableInvitation,
    GetInvitation,
    PreviewInvitation,
    RenewInvitation,
)
from app.application.use_cases.projects.team import JoinProject, RemoveMember, UpdateMember
from app.domain.accounts import Account
from app.domain.project import Member, Project

router = APIRouter(prefix="/api", tags=["team"])

MANAGE = [Depends(deps.allow("manage"))]


@router.patch("/projects/{project_id}/members/{member_id}", response_model=Project, dependencies=MANAGE)
async def update_member(
    project_id: int, member_id: int, body: MemberUpdate, use_case: UpdateMember = Depends(deps.get_update_member)
) -> Project:
    return await use_case.execute(project_id, member_id, body)


@router.delete("/projects/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    project_id: int,
    member_id: int,
    actor: Member = Depends(deps.allow("view")),
    use_case: RemoveMember = Depends(deps.get_remove_member),
) -> Response:
    """A leader removes anyone; a member can only remove themselves (leave the project)."""
    await use_case.execute(project_id, member_id, actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/projects/{project_id}/invitation", response_model=Invitation, dependencies=MANAGE)
def get_invitation(project_id: int, use_case: GetInvitation = Depends(deps.get_get_invitation)) -> Invitation:
    return use_case.execute(project_id)


@router.post("/projects/{project_id}/invitation", response_model=Invitation, dependencies=MANAGE)
def renew_invitation(project_id: int, use_case: RenewInvitation = Depends(deps.get_renew_invitation)) -> Invitation:
    return use_case.execute(project_id)


@router.delete("/projects/{project_id}/invitation", status_code=status.HTTP_204_NO_CONTENT, dependencies=MANAGE)
def disable_invitation(project_id: int, use_case: DisableInvitation = Depends(deps.get_disable_invitation)) -> Response:
    use_case.execute(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invitations/{token}", response_model=InvitationPreview)
def preview_invitation(
    token: str,
    account: Account | None = Depends(deps.optional_account),
    use_case: PreviewInvitation = Depends(deps.get_preview_invitation),
) -> InvitationPreview:
    """The only project endpoint that works signed out (FR-009)."""
    return use_case.execute(token, account)


@router.post("/invitations/{token}/join", response_model=JoinResult)
async def join(
    token: str,
    body: JoinRequest | None = Body(None),
    account: Account = Depends(deps.current_account),
    use_case: JoinProject = Depends(deps.get_join_project),
) -> JoinResult:
    return await use_case.execute(token, account, body or JoinRequest())
