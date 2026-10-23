"""Use case inputs and outputs. The HTTP adapter uses them as body/response."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.application.ports.code_host import CodeHostMode
from app.domain.board import (
    BoardWarning,
    ChecklistItem,
    Objective,
    Priority,
    Sprint,
    SprintLoad,
    Task,
    TaskStatus,
)
from app.domain.integrations import IssueRef
from app.domain.documents import Document, DocumentKind, DocumentVersion, VersionSource
from app.domain.plan import WipLimit
from app.domain.proposals import ProposalOrigin
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


class SprintView(Sprint):
    load: SprintLoad | None  # None on a continuous (Kanban) board


class TaskView(Task):
    """A task as the API returns it (board and task results)."""

    issue: IssueRef | None = None  # spec 007: the task's GitHub issue, None until published


class BoardView(BaseModel):
    project_id: int
    continuous: bool
    wip_limits: list[WipLimit]
    capacity_override: int | None
    sprints: list[SprintView]
    objectives: list[Objective]
    tasks: list[TaskView]


class _SentFields(BaseModel):
    def sent(self) -> dict[str, Any]:
        """Only the fields the client sent: a missing field is left as is, null clears it."""
        return self.model_dump(include=self.model_fields_set)


class TaskMove(_SentFields):
    """`sprint_id: null` = back to the backlog."""

    status: TaskStatus | None = None
    position: int | None = None
    sprint_id: int | None = None


class TaskEdit(_SentFields):
    """`assignee_id: null` = unassigned; assigning someone clears `missing_role`."""

    title: str | None = None
    description: str | None = None
    points: int | None = None
    priority: Priority | None = None
    assignee_id: int | None = None


class TaskUpdate(_SentFields):
    """PATCH /api/tasks/{id}: move fields and edit fields can be combined."""

    status: TaskStatus | None = None
    sprint_id: int | None = None
    assignee_id: int | None = None
    position: int | None = None
    title: str | None = None
    description: str | None = None
    points: int | None = None
    priority: Priority | None = None

    def move(self) -> TaskMove | None:
        sent = {k: v for k, v in self.sent().items() if k in TaskMove.model_fields}
        return TaskMove(**sent) if sent else None

    def edit(self) -> TaskEdit | None:
        sent = {k: v for k, v in self.sent().items() if k in TaskEdit.model_fields}
        return TaskEdit(**sent) if sent else None


class TaskCreate(_SentFields):
    """POST /api/projects/{id}/tasks (spec 014). Only `title` is required (checked by the domain,
    so its error reads like the edit ones); unsent fields take the `Task` defaults.
    `sprint_id: null` = the backlog, or the whole board when it's continuous."""

    title: str | None = None
    sprint_id: int | None = None
    status: TaskStatus | None = None
    description: str | None = None
    points: int | None = None
    priority: Priority | None = None
    assignee_id: int | None = None
    epic_key: str | None = None


class ChecklistUpdate(BaseModel):
    items: list[ChecklistItem]


class TaskResult(BaseModel):
    task: TaskView
    warnings: list[BoardWarning] = []  # never block (constitution, principle 4)
    suggest_advance: bool = False  # the checklist is complete: offer to move it forward (FR-015)


class CapacityUpdate(BaseModel):
    points_per_sprint: int | None  # required; null = back to the estimate from the team


class SprintLoadView(BaseModel):
    id: int
    load: SprintLoad


class CapacityResult(BaseModel):
    capacity_override: int | None
    sprints: list[SprintLoadView]


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


# ---------- Planning (spec 002) ----------


class StageRun(BaseModel):
    """A stage to run in the background after the request: StartPlanning and RetryStage
    decide it, the router spawns RunPlanningStep with it."""

    project_id: int
    stage: str
    feedback: dict[str, Any] | None = None  # {reason, rejected_content} when redoing a rejection
    run: bool = True  # False when the stage already has a proposal waiting for the leader


class PlanningAccepted(BaseModel):
    """202 body of POST /planning and POST /planning/stages/{key}/retry."""

    project_id: int
    status: ProjectStatus = "planning"
    stage: str


# ---------- Sync and replanning (spec 008) ----------

IgnoredReason = Literal["duplicate", "unhandled_event", "unknown_repository"]


class WebhookReceipt(BaseModel):
    """202 body of POST /webhooks/github: received, not necessarily applied."""

    delivery_id: str
    status: Literal["accepted", "ignored"]
    reason: IgnoredReason | None = None


class ReplanRequest(BaseModel):
    reason: str


class ReplanRun(BaseModel):
    """A replan to run in the background: Replan.prepare decides it, the router spawns it."""

    project_id: int
    reason: str  # merged with the reason of the pending replan it supersedes (FR-014)
    origin: ProposalOrigin = "leader"
    supersedes: int | None = None


class ReplanAccepted(BaseModel):
    """202 body of POST /api/projects/{id}/replan."""

    project_id: int
    status: Literal["replanning"] = "replanning"
    supersedes: int | None = None


class SprintCloseResult(BaseModel):
    sprint: Sprint
    pending_task_keys: list[str]
    replan_proposed: bool


class DevGithubEvent(BaseModel):
    """Body of the dev-only POST /api/dev/github-events (T029)."""

    fixture: str
    repository: str | None = None
    number: int | None = Field(default=None, ge=1)


# ---------- Documents (spec 006) ----------


class DocumentSummary(BaseModel):
    id: int
    kind: DocumentKind
    epic_key: str | None
    title: str
    version: int
    outdated: bool
    updated_at: datetime

    @classmethod
    def of(cls, document: Document) -> "DocumentSummary":
        return cls.model_validate(document.model_dump(include=set(cls.model_fields)))


class DocumentVersionView(BaseModel):
    version: int
    created_at: datetime
    source: VersionSource
    proposal_id: int | None


class DocumentView(BaseModel):
    """`content` and `version` are the requested version's (the latest by default)."""

    id: int
    project_id: int
    kind: DocumentKind
    epic_key: str | None
    title: str
    content: str
    version: int
    outdated: bool
    versions: list[DocumentVersionView]

    @classmethod
    def of(cls, document: Document, versions: list[DocumentVersion], shown: DocumentVersion | None = None) -> "DocumentView":
        data = document.model_dump(include=set(cls.model_fields) - {"versions"})
        if shown is not None:
            data.update(content=shown.content, version=shown.version)
        views = [DocumentVersionView.model_validate(v.model_dump(include=set(DocumentVersionView.model_fields))) for v in versions]
        return cls(**data, versions=views)


class DocumentRegenerate(BaseModel):
    instructions: str


class DocumentEdit(BaseModel):
    content: str
    base_version: int


class DocumentRun(BaseModel):
    """A document to rewrite in the background: RegenerateDocument decides it, the router spawns it."""

    project_id: int
    document_id: int
    key: str
    feedback: dict[str, Any]


class RegenerationAccepted(BaseModel):
    """202 body of POST /api/documents/{id}/regenerate."""

    document_id: int
    status: str = "regenerating"
