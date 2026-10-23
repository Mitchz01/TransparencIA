"""GenerateDocuments: the writer proposes the documents once the plan is complete (spec 006)."""

from app.adapters.outbound.agents.mock.data import MOCK_PLAN
from app.domain.plan import document_stage
from tests.unit.application.document_fixtures import writer
from tests.unit.application.planning_fixtures import ScriptedAgents

# ---------- US1: general spec ----------


def test_the_general_spec_is_proposed_first():
    w = writer()
    w.run()

    assert w.agents.stages()[0] == "general_spec"
    started = w.bus.of_type("agent_started")[0]
    assert started.agent == "general_spec" and started.title == "Spec writer"
    assert "general spec" in started.summary
    [proposal] = w.proposals("general_spec")
    assert proposal.status == "pending" and proposal.agent == "Spec writer" and proposal.rationale
    assert proposal.content["title"] == "General spec: Agile Planner"
    created = [e for e in w.bus.of_type("proposal_created") if e.key == "general_spec"]
    assert created[0].kind == "document" and created[0].proposal_id == proposal.id
    assert w.documents() == []  # nothing exists before it's approved (FR-002)


def test_the_context_only_has_the_approved_finals():
    w = writer()
    # A newer roadmap that was rejected, and a pending one: neither reaches the writer.
    other = {**MOCK_PLAN["roadmap"], "rationale": "Not approved"}
    w.seed("plan_stage", "roadmap", other, status="rejected", rejection_reason="No")
    w.seed("plan_stage", "roadmap", other, status="pending")
    w.run()

    context = w.agents.context("general_spec")
    assert set(context) == set(document_stage("general_spec").inputs)
    assert context["roadmap"] == MOCK_PLAN["roadmap"]
    assert context["project"]["name"] == "Agile Planner" and "status" not in context["project"]


def test_the_adjusted_version_of_a_stage_is_the_one_used():
    adjusted = {**MOCK_PLAN["analysis"], "summary": "Adjusted by the leader"}
    w = writer()
    w.seed("plan_stage", "analysis", MOCK_PLAN["analysis"], status="adjusted", adjusted_content=adjusted)
    w.run()
    assert w.agents.context("general_spec")["analysis"]["summary"] == "Adjusted by the leader"


def test_auto_approve_creates_the_document():
    w = writer(auto_approve=True)
    w.run()

    proposal = w.proposals("general_spec")[0]
    assert proposal.status == "approved" and proposal.auto_approved
    general = next(d for d in w.documents() if d.kind == "general_spec")
    assert general.version == 1 and general.title == "General spec: Agile Planner"


def test_a_failing_general_spec_is_reported_missing_without_failing_the_project():
    w = writer(ScriptedAgents({"general_spec": [RuntimeError("down"), RuntimeError("down again")]}))
    w.run()

    assert w.proposals("general_spec") == []
    [generated] = w.bus.of_type("documents_generated")
    assert "General spec" in generated.missing
    with w.uow:
        assert w.uow.projects.get(w.project.id).status == "ready"


def test_running_again_does_not_duplicate_proposed_documents():
    w = writer()
    w.run()
    w.run()
    assert len(w.proposals("general_spec")) == 1


# ---------- Rejections follow spec 002's redo rule ----------


def test_a_rejected_document_is_redone_with_the_reason():
    w = writer()
    w.run()
    first = w.proposals("general_spec")[0]
    w.reject(first, "Make it shorter")

    redo = w.proposals("general_spec")[-1]
    assert redo.id != first.id and redo.status == "pending"
    feedback = w.agents.context("general_spec")["feedback"]
    assert feedback == {"reason": "Make it shorter", "rejected_content": first.content}


def test_after_three_rejections_in_a_row_it_waits_for_the_leader():
    w = writer()
    w.run()
    for _ in range(3):
        w.reject(w.proposals("general_spec")[-1])

    assert [p.status for p in w.proposals("general_spec")] == ["rejected"] * 3
    [capped] = w.bus.of_type("stage_needs_leader")
    assert capped.stage == "general_spec" and capped.rejections == 3
