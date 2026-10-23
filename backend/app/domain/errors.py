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
