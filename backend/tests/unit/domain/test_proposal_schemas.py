import pytest
from pydantic import BaseModel

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.errors import ValidationFailed
from app.domain.proposal_schemas import content_schema, register_schema, validate_content


def test_every_plan_stage_has_a_schema():
    for key, content in MOCK_PLAN.items():
        assert validate_content("plan_stage", key, content)


def test_invalid_content_reports_content_prefixed_paths():
    bad = {**MOCK_PLAN["methodology"], "methodology": "waterfall"}
    bad.pop("sprint_length_weeks")
    with pytest.raises(ValidationFailed) as info:
        validate_content("plan_stage", "methodology", bad)
    fields = {e.field: e.message for e in info.value.errors}
    assert "content.methodology" in fields
    assert fields["content.sprint_length_weeks"] == "Required."


def test_unknown_subject_has_no_schema():
    with pytest.raises(ValidationFailed):
        content_schema("document", "general_spec")


def test_prefix_registration():
    class EpicSpec(BaseModel):
        markdown: str

    register_schema("document", "epic_spec:", EpicSpec)
    assert content_schema("document", "epic_spec:EP-2") is EpicSpec
