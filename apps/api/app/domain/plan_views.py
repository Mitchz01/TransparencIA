"""Read-only views of a project's plan (spec 004, UC-07): roadmap with progress,
methodology and architecture. Built by a pure function from the approved plan
(`project.plan`), the stage proposals and the board's tasks."""

from collections.abc import Sequence
from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel

from app.domain.board import Task
from app.domain.plan import Architecture, MethodologyDecision, Roadmap
from app.domain.project import Project
from app.domain.proposals import Proposal

ViewStatus = Literal["not_generated", "pending", "approved"]
Decision = Literal["leader", "adjusted", "auto"]

T = TypeVar("T", bound=BaseModel)


class ViewOrigin(BaseModel):
    agent: str
    rationale: str
    approved_at: datetime
    decision: Decision


class StageView(BaseModel, Generic[T]):
    status: ViewStatus
    origin: ViewOrigin | None = None  # only when approved
    content: T | None = None  # only when approved: pending content is never returned


class Progress(BaseModel):
    tasks: int = 0
    tasks_done: int = 0
    points: int = 0
    points_done: int = 0

    def add(self, task: Task) -> None:
        done = task.status == "done"
        self.tasks += 1
        self.points += task.points
        self.tasks_done += int(done)
        self.points_done += task.points if done else 0

    def __iadd__(self, other: "Progress") -> "Progress":
        self.tasks += other.tasks
        self.tasks_done += other.tasks_done
        self.points += other.points
        self.points_done += other.points_done
        return self


class EpicView(BaseModel):
    key: str
    title: str
    description: str
    progress: Progress
    has_tasks: bool


class PhaseView(BaseModel):
    name: str
    goal: str
    start_week: int
    end_week: int
    deliverables: list[str]
    epics: list[EpicView]
    progress: Progress


class RoadmapView(BaseModel):
    phases: list[PhaseView]
    progress: Progress  # whole project, including tasks without an epic
    current_week: int | None  # None until the board exists
    current_phase: str | None
    overdue: bool


class MethodologyView(BaseModel):
    decision: MethodologyDecision
    chosen_by: Literal["leader", "agents"]


class PlanViews(BaseModel):
    roadmap: StageView[RoadmapView]
    methodology: StageView[MethodologyView]
    architecture: StageView[Architecture]


# ---------- Rules ----------


def _stage_proposals(proposals: Sequence[Proposal], stage: str) -> list[Proposal]:
    """Newest first."""
    same = [p for p in proposals if p.kind == "plan_stage" and p.key == stage]
    return sorted(same, key=lambda p: (p.created_at, p.id or 0), reverse=True)


def _origin(proposals: Sequence[Proposal], stage: str) -> ViewOrigin | None:
    for proposal in _stage_proposals(proposals, stage):
        if proposal.decided and proposal.resolved_at is not None:
            decision: Decision = "auto" if proposal.auto_approved else "adjusted" if proposal.status == "adjusted" else "leader"
            return ViewOrigin(
                agent=proposal.agent, rationale=proposal.rationale, approved_at=proposal.resolved_at, decision=decision
            )
    return None


def _status(project: Project, proposals: Sequence[Proposal], stage: str) -> ViewStatus:
    if project.plan and stage in project.plan:
        return "approved"
    if any(p.status == "pending" for p in _stage_proposals(proposals, stage)):
        return "pending"
    return "not_generated"


def _view(project: Project, proposals: Sequence[Proposal], stage: str, content: BaseModel | None) -> dict:
    status = _status(project, proposals, stage)
    if status != "approved":
        return {"status": status}
    return {"status": status, "origin": _origin(proposals, stage), "content": content}


def current_week(start: datetime, today: date) -> int:
    return max((today - start.date()).days // 7 + 1, 1)


def _roadmap(roadmap: Roadmap, project: Project, proposals: Sequence[Proposal], tasks: Sequence[Task], today: date) -> RoadmapView:
    by_epic: dict[str, Progress] = {}
    total = Progress()
    for task in tasks:
        total.add(task)
        by_epic.setdefault(task.epic_key, Progress()).add(task)

    phases: list[PhaseView] = []
    for phase in roadmap.phases:
        epics = [
            EpicView(
                key=epic.key,
                title=epic.title,
                description=epic.description,
                progress=by_epic.get(epic.key, Progress()),
                has_tasks=epic.key in by_epic,
            )
            for epic in phase.epics
        ]
        phase_progress = Progress()
        for epic in epics:
            phase_progress += epic.progress
        phases.append(
            PhaseView(
                name=phase.name,
                goal=phase.goal,
                start_week=phase.start_week,
                end_week=phase.end_week,
                deliverables=phase.deliverables,
                epics=epics,
                progress=phase_progress,
            )
        )

    week: int | None = None
    phase_name: str | None = None
    overdue = False
    start = _origin(proposals, "sprints")
    if project.status == "ready" and start is not None:
        week = current_week(start.approved_at, today)
        last_week = max((p.end_week for p in roadmap.phases), default=week)
        if week > last_week:
            week, overdue = last_week, True
        phase_name = next((p.name for p in roadmap.phases if p.start_week <= week <= p.end_week), None)

    return RoadmapView(phases=phases, progress=total, current_week=week, current_phase=phase_name, overdue=overdue)


def build_plan_views(project: Project, proposals: Sequence[Proposal], tasks: Sequence[Task], today: date) -> PlanViews:
    plan = project.plan or {}

    roadmap = None
    if "roadmap" in plan:
        roadmap = _roadmap(Roadmap.model_validate(plan["roadmap"]), project, proposals, tasks, today)

    methodology = None
    if "methodology" in plan:
        chosen_by = "leader" if project.requested_methodology != "auto" else "agents"
        methodology = MethodologyView(decision=MethodologyDecision.model_validate(plan["methodology"]), chosen_by=chosen_by)

    architecture = Architecture.model_validate(plan["architecture"]) if "architecture" in plan else None

    return PlanViews(
        roadmap=StageView[RoadmapView](**_view(project, proposals, "roadmap", roadmap)),
        methodology=StageView[MethodologyView](**_view(project, proposals, "methodology", methodology)),
        architecture=StageView[Architecture](**_view(project, proposals, "architecture", architecture)),
    )
