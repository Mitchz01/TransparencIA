import asyncio
import copy
from typing import Any

from pydantic import BaseModel

from app.adapters.outbound.agents.mock import data
from app.adapters.outbound.agents.mock.data import MOCK_DOCUMENTS, MOCK_PLAN
from app.domain.plan import PlanningStage


class MockPlanningAgents:
    """Returns the sample plan after a delay, to develop the frontend without an API key.

    The sample is fitted to the context like a real agent would, so it passes the stage
    consistency rules with any team (spec 002, SC-006): the requested methodology is kept,
    stories only use roadmap epics, and iterations are packed by capacity and assigned to
    real members by role."""

    def __init__(self, delay_seconds: float = 0.8):
        self._delay = delay_seconds

    async def run_stage(self, stage: PlanningStage, context: dict[str, Any]) -> BaseModel:
        await asyncio.sleep(self._delay)
        output = copy.deepcopy({**MOCK_PLAN, **MOCK_DOCUMENTS}[stage.key])
        fit = _FITTERS.get(stage.key)
        if fit is not None:
            output = fit(output, context)
        return stage.schema.model_validate(output)


def _fit_methodology(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    requested = (context.get("project") or {}).get("requested_methodology", "auto")
    if requested in ("auto", output["methodology"]):
        return output
    output["alternatives"] = [a for a in output["alternatives"] if a["methodology"] != requested]
    output["alternatives"].append({"methodology": output["methodology"], "why_not": "The leader chose another one."})
    output["methodology"] = requested
    output["rationale"] = f"The leader chose {requested}; it's adapted to this team's size and deadline."
    return output


def _fit_backlog(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    roadmap = context.get("roadmap")
    if not roadmap:
        return output
    epics = {epic["key"] for phase in roadmap["phases"] for epic in phase["epics"]}
    output["stories"] = [s for s in output["stories"] if s["epic_key"] in epics]
    return output


def _fit_sprints(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    stories = (context.get("backlog") or {}).get("stories")
    if stories is None:
        return output
    capacity = (context.get("capacity") or {}).get("points_per_sprint") or 0
    phase_of = {
        epic["key"]: phase["name"] for phase in (context.get("roadmap") or {}).get("phases", []) for epic in phase["epics"]
    }

    # Pack the stories in backlog order; a story bigger than the capacity gets its own iteration.
    sprints: list[list[dict[str, Any]]] = []
    load = 0
    for story in stories:
        if not sprints or load + story["points"] > capacity:
            sprints.append([])
            load = 0
        sprints[-1].append(story)
        load += story["points"]

    # Assign by role to the member with the fewest points so far; no fitting role = unassigned.
    members = (context.get("project") or {}).get("members", [])
    assigned_points = {m["name"]: 0 for m in members}
    assignments = []
    for story in stories:
        fitting = [m["name"] for m in members if m["role"].casefold() == story["role"].casefold()]
        if fitting:
            name = min(fitting, key=lambda n: assigned_points[n])
            assigned_points[name] += story["points"]
            assignments.append({"story_key": story["key"], "member_name": name})

    output["sprints"] = [
        {
            "number": i,
            "name": f"Sprint {i}",
            "goal": f"Deliver {', '.join(s['title'].lower() for s in batch[:2])}",
            "phase": phase_of.get(batch[0]["epic_key"], ""),
            "story_keys": [s["key"] for s in batch],
        }
        for i, batch in enumerate(sprints, 1)
    ]
    output["assignments"] = assignments
    return output


# ---------- Writer (spec 006): the documents describe this project's approved plan ----------


def _with_feedback(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """A regeneration or a redo shows the leader's instructions were taken in."""
    reason = (context.get("feedback") or {}).get("reason")
    if reason:
        output["markdown"] += f"\n\n## Leader's notes\n\n- {reason}"
        output["rationale"] = f"Rewritten following the leader's instructions: {reason}"
    return output


def _fit_general_spec(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if context.get("project") and context.get("roadmap"):
        output = data.general_spec_output(
            context["project"], context.get("analysis") or {}, context["roadmap"], context.get("backlog") or {}
        )
    return _with_feedback(output, context)


def _fit_epic_spec(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if context.get("epic"):
        output = data.epic_spec_output(context["epic"], context.get("stories") or [])
    return _with_feedback(output, context)


def _fit_flow_diagrams(output: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if context.get("architecture") or context.get("roadmap"):
        output = data.flow_diagrams_output(context.get("architecture") or {}, context.get("roadmap") or {})
    reason = (context.get("feedback") or {}).get("reason")
    if reason:
        output["rationale"] = f"Redrawn following the leader's instructions: {reason}"
    return output


_FITTERS = {
    "methodology": _fit_methodology,
    "backlog": _fit_backlog,
    "sprints": _fit_sprints,
    "general_spec": _fit_general_spec,
    "epic_spec": _fit_epic_spec,
    "flow_diagrams": _fit_flow_diagrams,
}
