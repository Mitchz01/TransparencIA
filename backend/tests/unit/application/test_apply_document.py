"""ApplyDocumentProposal (spec 005's `document` applier) and MarkDocumentsOutdated (spec 006)."""

import asyncio

import pytest

from app.application.use_cases.documents.mark_outdated import MarkDocumentsOutdated
from app.domain.errors import InvalidDiagram
from tests.unit.application.document_fixtures import GENERAL, writer

DIAGRAM = {"title": "Sign-up", "kind": "flow", "mermaid": 'flowchart TD\n    A["Open"] --> B["Sign up"]', "rationale": "x"}


def test_approving_creates_version_1():
    w = writer()
    proposal = w.seed("document", "general_spec", GENERAL, status="pending")
    assert w.documents() == []  # nothing exists before approval (constitution, principle 8)

    w.approve(proposal)

    [document] = w.documents()
    assert (document.kind, document.key, document.epic_key) == ("general_spec", "general_spec", None)
    assert document.title == GENERAL["title"] and document.content == GENERAL["markdown"]
    assert document.version == 1 and not document.outdated
    [version] = w.versions(document.id)
    assert (version.version, version.proposal_id, version.source) == (1, proposal.id, "agent")
    [saved] = w.bus.of_type("document_saved")
    assert saved.document_id == document.id and saved.version == 1 and saved.source == "agent"


def test_an_epic_spec_keeps_its_epic_and_a_diagram_its_mermaid():
    w = writer()
    epic = {"epic_key": "EP-2", "title": "Projects and team", "markdown": "# EP-2", "rationale": "x"}
    w.approve(w.seed("document", "epic_spec:EP-2", epic, status="pending"))
    w.approve(w.seed("document", "flow_diagram:1", DIAGRAM, status="pending"))

    spec, diagram = w.documents()
    assert (spec.kind, spec.epic_key, spec.title) == ("epic_spec", "EP-2", "Projects and team")
    assert (diagram.kind, diagram.epic_key, diagram.content) == ("flow_diagram", None, DIAGRAM["mermaid"])


def test_the_adjusted_content_is_what_gets_saved():
    w = writer()
    proposal = w.seed("document", "general_spec", GENERAL, status="pending")
    w.approve(proposal, {**GENERAL, "markdown": "# Leader's version"})
    assert w.documents()[0].content == "# Leader's version"


def test_a_later_approval_adds_a_version_and_keeps_the_old_one():
    w = writer()
    w.approve(w.seed("document", "general_spec", GENERAL, status="pending"))
    second = w.seed("document", "general_spec", {**GENERAL, "markdown": "# v2"}, status="pending")
    w.approve(second)

    [document] = w.documents()
    assert document.version == 2 and document.content == "# v2"
    versions = w.versions(document.id)
    assert [(v.version, v.content) for v in versions] == [(1, GENERAL["markdown"]), (2, "# v2")]
    assert versions[1].proposal_id == second.id


def test_applying_the_same_proposal_twice_adds_nothing():
    w = writer()
    proposal = w.seed("document", "general_spec", GENERAL, status="pending")
    w.approve(proposal)
    asyncio.run(w.apply_document.execute(proposal.id))
    assert w.documents()[0].version == 1 and len(w.versions(w.documents()[0].id)) == 1


def test_a_diagram_that_would_not_render_is_never_saved():
    w = writer()
    proposal = w.seed("document", "flow_diagram:1", {**DIAGRAM, "mermaid": "pie\n  A"}, status="approved")
    with pytest.raises(InvalidDiagram):
        asyncio.run(w.apply_document.execute(proposal.id))
    assert w.documents() == []


def test_a_pending_or_rejected_proposal_creates_nothing():
    w = writer()
    for status in ("pending", "rejected"):
        proposal = w.seed("document", "general_spec", GENERAL, status=status)
        asyncio.run(w.apply_document.execute(proposal.id))
    assert w.documents() == []


# ---------- MarkDocumentsOutdated (spec 008 calls it after a replan) ----------


def _mark(w) -> list[int]:
    return asyncio.run(MarkDocumentsOutdated(w.uow.factory(), w.bus).execute(w.project.id))


def test_a_replan_flags_every_document_as_outdated():
    w = writer()
    w.approve(w.seed("document", "general_spec", GENERAL, status="pending"))
    w.approve(w.seed("document", "flow_diagram:1", DIAGRAM, status="pending"))

    ids = _mark(w)
    assert sorted(ids) == sorted(d.id for d in w.documents())
    assert all(d.outdated for d in w.documents())
    assert all(d.version == 1 for d in w.documents())  # flagged, never rewritten by itself
    [event] = w.bus.of_type("documents_outdated")
    assert sorted(event.document_ids) == sorted(ids)

    assert _mark(w) == [] and len(w.bus.of_type("documents_outdated")) == 1  # already outdated: nothing new


def test_a_new_version_clears_the_flag():
    w = writer()
    w.approve(w.seed("document", "general_spec", GENERAL, status="pending"))
    _mark(w)
    w.approve(w.seed("document", "general_spec", {**GENERAL, "markdown": "# regenerated"}, status="pending"))

    [document] = w.documents()
    assert document.version == 2 and not document.outdated


def test_no_documents_no_event():
    w = writer()
    assert _mark(w) == [] and w.bus.of_type("documents_outdated") == []
