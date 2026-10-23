"""Spec 015 (US5, FR-007, FR-012): may this account do `action` on this resource's project?"""

from typing import Literal

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.accounts import Account, ProjectAction, check_access
from app.domain.errors import (
    DocumentNotFound,
    DomainError,
    MemberNotFound,
    NotFound,
    ProjectNotFound,
    ProposalNotFound,
    SprintNotFound,
    TaskNotFound,
)
from app.domain.project import Member

Resource = Literal["project", "task", "sprint", "proposal", "document", "member"]

_NOT_FOUND: dict[Resource, type[NotFound]] = {
    "project": ProjectNotFound,
    "task": TaskNotFound,
    "sprint": SprintNotFound,
    "proposal": ProposalNotFound,
    "document": DocumentNotFound,
    "member": MemberNotFound,
}


class AuthorizeAccess:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, account: Account, resource: Resource, resource_id: int, action: ProjectAction) -> Member:
        """The caller's member in the resource's project. Outsiders get the resource's own
        not found, like a missing id; members doing a leader action get Forbidden."""
        not_found = _NOT_FOUND[resource](resource_id)  # type: ignore[call-arg]
        project_id = self._project_id(resource, resource_id)
        project = self._uow.projects.get(project_id) if project_id is not None else None
        if project is None:
            raise not_found
        try:
            return check_access(project, account.id, action)
        except ProjectNotFound:
            raise not_found from None

    def allows(self, account: Account, resource: Resource, resource_id: int, action: ProjectAction) -> bool:
        try:
            self.execute(account, resource, resource_id, action)
        except DomainError:
            return False
        return True

    def _project_id(self, resource: Resource, resource_id: int) -> int | None:
        if resource == "project":
            return resource_id
        if resource == "member":
            project = self._uow.projects.get_by_member(resource_id)
            return project.id if project else None
        if resource == "task":
            task = self._uow.tasks.get(resource_id)
            return task.project_id if task else None
        if resource == "sprint":
            sprint = self._uow.sprints.get(resource_id)
            return sprint.project_id if sprint else None
        if resource == "proposal":
            proposal = self._uow.proposals.get(resource_id)
            return proposal.project_id if proposal else None
        document = self._uow.documents.get(resource_id)
        return document.project_id if document else None
