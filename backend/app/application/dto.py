"""Use case inputs and outputs. The HTTP adapter uses them as body/response."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

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
from app.domain.plan import WipLimit
from app.domain.project import (
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


class BoardView(BaseModel):
    project_id: int
    continuous: bool
    wip_limits: list[WipLimit]
    capacity_override: int | None
    sprints: list[SprintView]
    objectives: list[Objective]
    tasks: list[Task]


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


class ChecklistUpdate(BaseModel):
    items: list[ChecklistItem]


class TaskResult(BaseModel):
    task: Task
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
