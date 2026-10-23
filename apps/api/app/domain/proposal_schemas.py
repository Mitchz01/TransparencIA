"""The content schema of each proposal subject (spec 005, FR-005): adjusting a proposal
validates the leader's version with the same structure the agent had to follow.
There's no free-form content (constitution, principle 2)."""

from typing import Any

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

from app.domain.errors import FieldError, ValidationFailed
from app.domain.integrations import IssuesToPublish, ReviewToRequest
from app.domain.plan import PLANNING_STAGES, DiagramProposal, EpicSpec, GeneralSpec, ReplanContent

# (kind, key) -> schema. Specs 006, 007 and 008 add their subjects with register_schema();
# a key prefix ending in ":" matches every key that starts with it ("epic_spec:" → "epic_spec:EP-2").
_SCHEMAS: dict[tuple[str, str], type[BaseModel]] = {("plan_stage", stage.key): stage.schema for stage in PLANNING_STAGES}
# Spec 006's documents: each diagram is its own proposal, so it's one diagram, not FlowDiagrams.
_SCHEMAS[("document", "general_spec")] = GeneralSpec
_SCHEMAS[("document", "epic_spec:")] = EpicSpec
_SCHEMAS[("document", "flow_diagram:")] = DiagramProposal


def register_schema(kind: str, key: str, schema: type[BaseModel]) -> None:
    _SCHEMAS[(kind, key)] = schema


# Spec 007: what will be written to GitHub.
register_schema("github_action", "create_issues", IssuesToPublish)
register_schema("github_action", "request_review", ReviewToRequest)
# Spec 008: a replan's changes; adjusting it is removing changes (FR-013).
register_schema("replan", "replan", ReplanContent)


def content_schema(kind: str, key: str) -> type[BaseModel]:
    if (kind, key) in _SCHEMAS:
        return _SCHEMAS[(kind, key)]
    for (known_kind, known_key), schema in _SCHEMAS.items():
        if known_kind == kind and known_key.endswith(":") and key.startswith(known_key):
            return schema
    raise ValidationFailed.single("content", f"No schema is defined for {kind} '{key}'.")


def _path(loc: tuple[Any, ...]) -> str:
    path = "content"
    for part in loc:
        path += f"[{part}]" if isinstance(part, int) else f".{part}"
    return path


def validate_content(kind: str, key: str, content: dict[str, Any]) -> dict[str, Any]:
    """Returns the content as the schema dumps it, or raises ValidationFailed with
    `content.`-prefixed field paths (spec 005's API contract)."""
    schema = content_schema(kind, key)
    try:
        return schema.model_validate(content).model_dump(mode="json")
    except PydanticValidationError as error:
        errors = [
            FieldError(_path(tuple(e["loc"])), "Required." if e["type"] == "missing" else e["msg"].rstrip(".") + ".")
            for e in error.errors()
        ]
        raise ValidationFailed(errors, "The adjusted content doesn't match the proposal's schema.") from None
