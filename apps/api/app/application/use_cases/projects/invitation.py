"""UC-16 · The project's invitation link (spec 015, US4)."""

import secrets

from app.application.dto import Invitation, InvitationPreview
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.accounts import Account, member_of
from app.domain.errors import InvitationNotFound, ProjectNotFound
from app.domain.project import Project


def new_invite_token() -> str:
    return secrets.token_urlsafe(16)


def _project(uow: UnitOfWork, project_id: int) -> Project:
    project = uow.projects.get(project_id)
    if project is None:
        raise ProjectNotFound(project_id)
    return project


class GetInvitation:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> Invitation:
        return Invitation.of(_project(self._uow, project_id))


class RenewInvitation:
    """A new link; the old one stops working (FR-008). Also turns invitations back on."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> Invitation:
        project = _project(self._uow, project_id).model_copy(update={"invite_token": new_invite_token()})
        saved = self._uow.projects.save(project)
        self._uow.commit()
        return Invitation.of(saved)


class DisableInvitation:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> None:
        self._uow.projects.save(_project(self._uow, project_id).model_copy(update={"invite_token": None}))
        self._uow.commit()


class PreviewInvitation:
    """What the link shows before joining, also without a session (FR-009)."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, token: str, account: Account | None) -> InvitationPreview:
        project = self._uow.projects.get_by_invite_token(token)
        if project is None:
            raise InvitationNotFound()
        return InvitationPreview(
            project_name=project.name,
            leaders=[m.name for m in project.members if m.permission == "leader"],
            already_member=account is not None and member_of(project, account.id) is not None,
        )
