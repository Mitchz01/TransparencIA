"""Use case inputs and outputs. The HTTP adapter uses them as body/response."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.application.ports.code_host import CodeHostMode
from app.domain.board import Sprint, Task, TaskStatus
from app.domain.project import (
    Member,
    MemberPatch,
    Project,
    ProjectChanges,
    ProjectStatus,
    RequestedMethodology,
    Seniority,
)

# ---------- Projects (spec 001) ----------


class MemberCreate(BaseModel):
    name: str
    role: str
    seniority: Seniority = "mid"
    hours_per_week: int = 20
    skills: list[str] = []


class ProjectCreate(BaseModel):
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: RequestedMethodology = "auto"
    auto_approve: bool = False
    members: list[MemberCreate]


class MemberUpsert(BaseModel):
    """An item of the whole new team in a PATCH: `id` = edit that member, no `id` = new member.
    Only the fields sent are applied."""

    id: int | None = None
    name: str | None = None
    role: str | None = None
    seniority: Seniority | None = None
    hours_per_week: int | None = None
    skills: list[str] | None = None


class ProjectUpdate(BaseModel):
    """Partial update: missing fields are left as they are."""

    name: str | None = None
    description: str | None = None
    duration_weeks: int | None = None
    requested_methodology: RequestedMethodology | None = None
    auto_approve: bool | None = None
    members: list[MemberUpsert] | None = None

    def to_changes(self) -> ProjectChanges:
        sent = self.model_dump(include=self.model_fields_set - {"members"})
        members = None
        if "members" in self.model_fields_set and self.members is not None:
            members = [MemberPatch(m.id, m.model_dump(include=m.model_fields_set - {"id"})) for m in self.members]
        elif "members" in self.model_fields_set:
            sent["members"] = None  # explicit null: reported as "Required."
        return ProjectChanges(values=sent, members=members)


class ProjectSummary(BaseModel):
    id: int
    name: str
    status: ProjectStatus
    duration_weeks: int
    member_count: int
    created_at: datetime

    @classmethod
    def of(cls, project: Project) -> "ProjectSummary":
        return cls(
            id=project.id or 0,
            name=project.name,
            status=project.status,
            duration_weeks=project.duration_weeks,
            member_count=len(project.members),
            created_at=project.created_at,
        )


class ProjectDetail(BaseModel):
    project: Project
    sprints: list[Sprint]
    tasks: list[Task]


# ---------- Board (spec 003) ----------


class TaskUpdate(BaseModel):
    status: TaskStatus | None = None
    sprint_id: int | None = None
    assignee_id: int | None = None
    position: int | None = None
    title: str | None = None
    description: str | None = None
    points: int | None = None


# ---------- Proposals and activity (spec 005) ----------


class ProposalAdjust(BaseModel):
    content: dict[str, Any]


class ProposalReject(BaseModel):
    reason: str


class BulkApprove(BaseModel):
    ids: list[int]


class BulkResult(BaseModel):
    id: int
    ok: bool
    error: dict[str, Any] | None = None


# ---------- GitHub integration (spec 007) ----------


class RepositoryConnect(BaseModel):
    repository: str
    # Write-only. Missing (or null) = keep the project's token; "" = delete it (FR-004).
    token: str | None = None


class Connection(BaseModel):
    repository: str
    has_token: bool
    mode: CodeHostMode
    webhook_registered: bool
    replaced: str | None = None


class IssuesProposed(BaseModel):
    proposal_id: int
    task_count: int


class GithubUsernameSet(BaseModel):
    github_username: str | None  # required; null removes it


class MemberGithubAccess(BaseModel):
    member: Member
    # False = the user can't access the repo (saved with a warning); None = no repo or GitHub unreachable.
    has_access: bool | None
