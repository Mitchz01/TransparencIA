"""Business errors. Each one has a stable `code` (plan/api-conventions.md, "Error codes");
the HTTP adapter maps them to a status code and the shared error body."""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FieldError:
    field: str  # path into the request body, e.g. "members[1].name"; "" = the whole body
    message: str


class DomainError(Exception):
    code = "domain_error"

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail

    def extra(self) -> dict[str, Any]:
        """Context fields added next to code/detail in the error body."""
        return {}


class NotFound(DomainError):
    def __init__(self, entity: str, id: int | None):
        super().__init__(f"{entity} {id} does not exist.")
        self.entity = entity
        self.id = id

    @property
    def code(self) -> str:  # type: ignore[override]
        return f"{self.entity.lower()}_not_found"


class ProjectNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Project", id)


class TaskNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Task", id)


class ProposalNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Proposal", id)


class ValidationFailed(DomainError):
    code = "validation_failed"

    def __init__(self, errors: list[FieldError], detail: str = "The request has invalid fields."):
        super().__init__(detail)
        self.errors = errors

    @classmethod
    def single(cls, field: str, message: str) -> "ValidationFailed":
        return cls([FieldError(field, message)])


class MethodologyLocked(DomainError):
    code = "methodology_locked"

    def __init__(self) -> None:
        super().__init__("The methodology can't change once planning has started.")


class ProposalAlreadyResolved(DomainError):
    code = "proposal_already_resolved"

    def __init__(self, id: int | None, status: str):
        super().__init__(f"Proposal {id} is already {status}.")
        self.id = id
        self.status = status

    def extra(self) -> dict[str, Any]:
        return {"status": self.status}


class ProposalNotRetryable(DomainError):
    code = "proposal_not_retryable"

    def __init__(self, id: int | None):
        super().__init__(f"Proposal {id} has no failed application to retry.")
        self.id = id


class CapacityNotApplicable(DomainError):
    """A Kanban project has a continuous board: there's no sprint capacity to set (spec 003)."""

    code = "capacity_not_applicable"

    def __init__(self, project_id: int | None):
        super().__init__(f"Project {project_id} uses Kanban: its board has no sprint capacity.")
        self.project_id = project_id


# TODO(spec 008): SprintClosed (409 sprint_closed) once sprints can be closed; PATCH /tasks/{id}
# then rejects moving a task into a closed sprint (plan 003, API Contract).


class NoApplierForProposal(DomainError):
    """No spec registered a step to apply this kind of proposal (yet). The decision stays
    saved and the application is reported as failed, so it can be retried later."""

    code = "no_applier_for_proposal"

    def __init__(self, kind: str, key: str):
        super().__init__(f"Nothing applies {kind} proposals ('{key}') yet.")


# ---------- GitHub integration (spec 007) ----------


class MemberNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Member", id)


class RepositoryNotAccessible(DomainError):
    """The repo doesn't exist, the token can't see it, or it lacks permissions. Nothing is saved."""

    code = "repository_not_accessible"
    _DETAILS = {
        "not_found": "The repository {repo} doesn't exist or the token can't see it.",
        "forbidden": "The token has no access to {repo}.",
        "missing_permissions": "The token can't create issues, comment or manage webhooks in {repo}.",
    }

    def __init__(self, repository: str, reason: str):
        super().__init__(self._DETAILS.get(reason, "The repository {repo} isn't accessible.").format(repo=repository))
        self.repository = repository
        self.reason = reason  # "not_found" | "forbidden" | "missing_permissions"

    def extra(self) -> dict[str, Any]:
        return {"reason": self.reason}


class RepositoryNotConnected(DomainError):
    code = "repository_not_connected"

    def __init__(self, project_id: int | None):
        super().__init__(f"Project {project_id} has no connected repository.")
        self.project_id = project_id


class NothingToPublish(DomainError):
    code = "nothing_to_publish"

    def __init__(self) -> None:
        super().__init__("Every task already has an issue.")


class PublicationPending(DomainError):
    code = "publication_pending"

    def __init__(self, proposal_id: int | None):
        super().__init__(f"Proposal {proposal_id} to publish issues is still pending.")
        self.proposal_id = proposal_id

    def extra(self) -> dict[str, Any]:
        return {"proposal_id": self.proposal_id}


class CodeHostUnavailable(DomainError):
    """GitHub failed or timed out (5xx, timeout, rate limit), after the client's retries."""

    code = "code_host_unavailable"

    def __init__(self, detail: str = "GitHub didn't answer. Try again in a moment."):
        super().__init__(detail)
