"""What each stage's agent sees (spec 002, FR-002): the project and its team, plus the final
version (approved or adjusted) of the previous stages it needs. Pending and rejected
proposals never reach it, except a rejected one passed back as `feedback` to redo it."""

from collections.abc import Sequence
from typing import Any

from app.domain.board import DEFAULT_SPRINT_WEEKS
from app.domain.capacity import member_capacity, team_capacity
from app.domain.plan import PlanningStage
from app.domain.project import Project
from app.domain.proposals import Proposal


def project_context(project: Project) -> dict[str, Any]:
    """What the agents see of the project: input data, no ids, status or auto-approve."""
    data = project.model_dump(mode="json", include={"name", "description", "duration_weeks", "requested_methodology"})
    data["members"] = [
        m.model_dump(mode="json", include={"name", "role", "seniority", "hours_per_week", "skills"})
        for m in project.members
    ]
    return data


def stage_history(proposals: Sequence[Proposal], key: str) -> list[Proposal]:
    """The plan_stage proposals of one stage, newest first (the repo's order)."""
    return [p for p in proposals if p.kind == "plan_stage" and p.key == key]


def approved_outputs(proposals: Sequence[Proposal]) -> dict[str, dict[str, Any]]:
    """The final content of the newest approved or adjusted proposal of each stage."""
    outputs: dict[str, dict[str, Any]] = {}
    for proposal in proposals:  # newest first: the first decided one per key wins
        if proposal.kind == "plan_stage" and proposal.decided and proposal.key not in outputs:
            outputs[proposal.key] = proposal.final_content
    return outputs


def capacity_context(project: Project, methodology: dict[str, Any] | None) -> dict[str, Any]:
    """Points per iteration, with the same rule as the board's overload warning (spec 003, FR-017)."""
    weeks = (methodology or {}).get("sprint_length_weeks") or DEFAULT_SPRINT_WEEKS
    team = team_capacity(project.members, weeks)
    return {
        "sprint_length_weeks": weeks,
        "points_per_sprint": project.sprint_capacity_override if project.sprint_capacity_override is not None else team,
        "members": [{"name": m.name, "points_per_sprint": member_capacity(m, weeks)} for m in project.members],
    }


def rejection_feedback(proposal: Proposal) -> dict[str, Any]:
    """Context for redoing a rejected stage: the leader's reason and what they rejected."""
    return {"reason": proposal.rejection_reason or "", "rejected_content": proposal.content}


def roadmap_epics(roadmap: dict[str, Any] | None) -> list[dict[str, Any]]:
    """The approved roadmap's epics in roadmap order, each with its phase name (spec 006)."""
    return [
        {**epic, "phase": phase["name"]} for phase in (roadmap or {}).get("phases", []) for epic in phase.get("epics", [])
    ]


def build_document_context(
    stage: PlanningStage,
    project: Project,
    outputs: dict[str, dict[str, Any]],
    epic: dict[str, Any] | None = None,
    feedback: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Like build_stage_context, for the writer (spec 006, FR-003): the approved finals in
    `outputs` plus, per epic, the derived `epic` and `stories` (only that epic's)."""
    available: dict[str, Any] = {**outputs, "project": project_context(project)}
    if epic is not None:
        available["epic"] = epic
        stories = (outputs.get("backlog") or {}).get("stories", [])
        available["stories"] = [s for s in stories if s["epic_key"] == epic["key"]]
    context = {key: available.get(key) for key in stage.inputs}
    if feedback is not None:
        context["feedback"] = feedback
    return context


def build_stage_context(
    stage: PlanningStage,
    project: Project,
    proposals: Sequence[Proposal],
    feedback: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Only the keys in `stage.inputs`, plus `feedback` when the stage is being redone."""
    outputs = approved_outputs(proposals)
    available: dict[str, Any] = {**outputs, "project": project_context(project)}
    if "capacity" in stage.inputs:
        available["capacity"] = capacity_context(project, outputs.get("methodology"))
    context = {key: available.get(key) for key in stage.inputs}
    if feedback is not None:
        context["feedback"] = feedback
    return context
