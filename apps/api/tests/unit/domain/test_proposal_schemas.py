import pytest
from pydantic import BaseModel

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.errors import ValidationFailed
from app.domain.plan import DiagramProposal, EpicSpec, GeneralSpec
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
        content_schema("github_action", "not_a_subject")


def test_prefix_registration():
    # A kind nobody else registers, so the real schemas (spec 006's epic_spec:) stay in place.
    class Sample(BaseModel):
        markdown: str

    register_schema("replan", "sample:", Sample)
    assert content_schema("replan", "sample:EP-2") is Sample


def test_document_subjects_have_their_schemas():
    assert content_schema("document", "general_spec") is GeneralSpec
    assert content_schema("document", "epic_spec:EP-10") is EpicSpec
    assert content_schema("document", "flow_diagram:2") is DiagramProposal


def test_an_adjusted_diagram_that_would_not_render_is_refused():
    with pytest.raises(ValidationFailed) as error:
        validate_content("document", "flow_diagram:1", {"title": "Sign-up", "kind": "flow", "mermaid": "pie\n  A"})
    assert [e.field for e in error.value.errors] == ["content.mermaid"]
