"""RegenerateDocument and EditDocument: both end in a new version and keep the old ones (spec 006, US4)."""

import asyncio

import pytest

from app.application.use_cases.documents.edit_document import EditDocument
from app.application.use_cases.documents.regenerate_document import RegenerateDocument
from app.domain.errors import DocumentNotFound, InvalidDiagram, RegenerationInProgress, ValidationFailed, VersionConflict
from tests.unit.application.document_fixtures import GENERAL, Writer, writer
from tests.unit.application.planning_fixtures import ScriptedAgents

DIAGRAM = {"title": "Checkout", "kind": "flow", "mermaid": 'flowchart TD\n    A["Cart"] --> B["Pay"]', "rationale": "x"}


def _approved(w: Writer, key: str = "general_spec", content: dict | None = None) -> int:
    """A document at version 1 through an approved proposal; returns its id."""
    w.approve(w.seed("document", key, content or GENERAL, status="pending"))
    return next(d.id for d in w.documents() if d.key == key)  # type: ignore[misc]


def _regenerate(w: Writer, document_id: int, instructions: str = "Add the payments flow") -> None:
    with w.uow:
        run = RegenerateDocument(w.uow, w.generate).execute(document_id, instructions)
    asyncio.run(w.generate.regenerate(run.project_id, run.key, run.feedback))


def _edit(w: Writer, document_id: int, content: str, base_version: int):
    with w.uow:
        return asyncio.run(EditDocument(w.uow, w.bus).execute(document_id, content, base_version))


# ---------- Regenerate ----------


def test_regenerating_proposes_with_the_instructions_as_feedback():
    w = writer()
    doc_id = _approved(w)
    _regenerate(w, doc_id)

    feedback = w.agents.context("general_spec")["feedback"]
    assert feedback == {"reason": "Add the payments flow", "rejected_content": {"title": GENERAL["title"], "markdown": GENERAL["markdown"]}}
    proposal = w.proposals("general_spec")[-1]
    assert proposal.status == "pending" and "Add the payments flow" in proposal.content["markdown"]
    assert w.documents()[0].version == 1  # still v1 until it's approved
    assert not w.generate.is_running(w.project.id, "general_spec")


def test_approving_the_regeneration_makes_version_2_and_keeps_version_1():
    w = writer()
    doc_id = _approved(w)
    _regenerate(w, doc_id)
    w.approve(w.proposals("general_spec")[-1])

    [document] = w.documents()
    assert document.version == 2 and "Add the payments flow" in document.content
    assert [v.content for v in w.versions(doc_id)] == [GENERAL["markdown"], document.content]


def test_regenerating_an_epic_spec_only_sends_that_epic():
    w = writer()
    doc_id = _approved(w, "epic_spec:EP-3", {"epic_key": "EP-3", "title": "Agents", "markdown": "# EP-3", "rationale": "x"})
    _regenerate(w, doc_id, "Add edge cases")

    context = w.agents.context("epic_spec")
    assert context["epic"]["key"] == "EP-3" and {s["epic_key"] for s in context["stories"]} == {"EP-3"}
    assert w.proposals("epic_spec:EP-3")[-1].content["epic_key"] == "EP-3"


def test_regenerating_a_diagram_proposes_the_one_with_the_same_title():
    w = writer()
    doc_id = _approved(w, "flow_diagram:2", {**DIAGRAM, "title": "MVP journey"})
    _regenerate(w, doc_id, "Add the payment step")

    proposal = w.proposals("flow_diagram:2")[-1]
    assert proposal.status == "pending" and proposal.content["title"] == "MVP journey"
    assert len([p for p in w.proposals() if p.key.startswith("flow_diagram:")]) == 2  # only the one


def test_a_failed_regeneration_is_reported_and_frees_the_document():
    w = writer(ScriptedAgents({"general_spec": [RuntimeError("down"), RuntimeError("down")]}))
    doc_id = _approved(w)
    _regenerate(w, doc_id)

    assert len(w.proposals("general_spec")) == 1
    assert w.bus.of_type("documents_generated")[-1].missing == ["general_spec"]
    assert not w.generate.is_running(w.project.id, "general_spec")


def test_a_second_regeneration_while_one_runs_or_waits_is_refused():
    w = writer()
    doc_id = _approved(w)
    with w.uow:
        RegenerateDocument(w.uow, w.generate).execute(doc_id, "First")  # claimed, not finished yet
        with pytest.raises(RegenerationInProgress):
            RegenerateDocument(w.uow, w.generate).execute(doc_id, "Second")

    w.generate._running.clear()  # the first run finished...
    w.seed("document", "general_spec", GENERAL, status="pending")  # ...and its proposal waits for the leader
    with w.uow, pytest.raises(RegenerationInProgress):
        RegenerateDocument(w.uow, w.generate).execute(doc_id, "Third")


def test_regenerate_checks():
    w = writer()
    doc_id = _approved(w)
    with w.uow:
        with pytest.raises(DocumentNotFound):
            RegenerateDocument(w.uow, w.generate).execute(999, "x")
        for instructions in ("  ", "x" * 2001):
            with pytest.raises(ValidationFailed) as error:
                RegenerateDocument(w.uow, w.generate).execute(doc_id, instructions)
            assert error.value.errors[0].field == "instructions"


# ---------- Edit by hand ----------


def test_an_edit_is_a_new_version_without_a_proposal():
    w = writer()
    doc_id = _approved(w)
    view = _edit(w, doc_id, "# Mine", 1)

    assert (view.version, view.content) == (2, "# Mine")
    assert [(v.version, v.source) for v in view.versions] == [(1, "agent"), (2, "leader")]
    assert len(w.proposals("general_spec")) == 1  # only the original one
    assert [v.content for v in w.versions(doc_id)] == [GENERAL["markdown"], "# Mine"]  # v1 kept
    saved = w.bus.of_type("document_saved")[-1]
    assert saved.source == "leader" and saved.actor == "person" and saved.version == 2


def test_editing_an_old_version_is_a_conflict():
    w = writer()
    doc_id = _approved(w)
    _edit(w, doc_id, "# v2", 1)
    with pytest.raises(VersionConflict) as error:
        _edit(w, doc_id, "# other", 1)
    assert error.value.extra() == {"current_version": 2}


def test_an_edited_diagram_must_render():
    w = writer()
    doc_id = _approved(w, "flow_diagram:1", DIAGRAM)
    with pytest.raises(InvalidDiagram) as error:
        _edit(w, doc_id, "pie\n  A", 1)
    assert error.value.code == "invalid_diagram" and {e.field for e in error.value.errors} == {"content"}


def test_edit_checks_the_content():
    w = writer()
    doc_id = _approved(w)
    for content in ("   ", "x" * 100_001):
        with pytest.raises(ValidationFailed) as error:
            _edit(w, doc_id, content, 1)
        assert error.value.errors[0].field == "content"
    with pytest.raises(DocumentNotFound):
        _edit(w, 999, "# x", 1)


# ---------- Rejections of every kind are redone ----------


def test_a_rejected_diagram_is_redone_under_the_same_key():
    w = writer()
    w.run()
    first = w.proposals("flow_diagram:2")[0]
    w.reject(first, "Show the payment")

    redo = w.proposals("flow_diagram:2")[-1]
    assert redo.id != first.id and redo.status == "pending" and redo.content["title"] == first.content["title"]
    assert w.agents.context("flow_diagrams")["feedback"]["reason"] == "Show the payment"
