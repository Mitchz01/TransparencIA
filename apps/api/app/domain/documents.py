"""Project documents (spec 006): the general spec, one spec per epic and the flow diagrams.
A document only exists once its proposal is approved (constitution, principle 8); every
approved content is a DocumentVersion, never deleted (FR-008)."""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

DocumentKind = Literal["general_spec", "epic_spec", "flow_diagram"]
# "agent" = an approved document proposal; "leader" = a manual edit, saved without a proposal.
VersionSource = Literal["agent", "leader"]

CONTENT_MAX = 100_000
INSTRUCTIONS_MAX = 2000


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Document(BaseModel):
    id: int | None = None
    project_id: int
    # The proposal key it comes from: "general_spec", "epic_spec:EP-2", "flow_diagram:1".
    # Every proposal (and regeneration) with this key versions the same document.
    key: str
    kind: DocumentKind
    epic_key: str | None = None  # only for epic_spec
    title: str
    # Markdown for specs, Mermaid for diagrams.
    content: str
    version: int = 1
    # The plan changed after it was approved (spec 008's replan); a new version clears it.
    outdated: bool = False
    updated_at: datetime = Field(default_factory=_now)

    def next_version(self, title: str, content: str) -> "Document":
        return self.model_copy(
            update={"title": title, "content": content, "version": self.version + 1, "outdated": False, "updated_at": _now()}
        )


class DocumentVersion(BaseModel):
    id: int | None = None
    document_id: int
    version: int
    content: str
    source: VersionSource = "agent"
    proposal_id: int | None = None  # the approved proposal; None for a leader's edit
    created_at: datetime = Field(default_factory=_now)


def document_kind(key: str) -> DocumentKind:
    """The kind of the document a proposal key versions ("epic_spec:EP-2" → "epic_spec")."""
    kind = key.split(":", 1)[0]
    if kind not in ("general_spec", "epic_spec", "flow_diagram"):
        raise ValueError(f"'{key}' isn't a document key")
    return kind  # type: ignore[return-value]


def document_from_proposal(project_id: int, key: str, content: dict[str, Any]) -> Document:
    """The document (at version 1) an approved proposal's final content describes. The content
    follows the schema registered for the key (proposal_schemas): title plus markdown or mermaid."""
    kind = document_kind(key)
    body = content["mermaid"] if kind == "flow_diagram" else content["markdown"]
    epic_key = key.split(":", 1)[1] if kind == "epic_spec" else None  # the key wins over the content
    return Document(project_id=project_id, key=key, kind=kind, epic_key=epic_key, title=content["title"], content=body)


def document_content(document: Document) -> dict[str, Any]:
    """The other way around: the document as proposal content, so a regeneration sees what
    it's rewriting (feedback.rejected_content, like a rejected stage)."""
    if document.kind == "flow_diagram":
        return {"title": document.title, "mermaid": document.content}
    content: dict[str, Any] = {"title": document.title, "markdown": document.content}
    if document.epic_key:
        content["epic_key"] = document.epic_key
    return content


def _natural(key: str) -> tuple[str, int, str]:
    """"EP-10" after "EP-2"; anything without a trailing number keeps its text order."""
    head, _, tail = key.rpartition("-") if "-" in key else key.rpartition(":")
    return (head, int(tail), "") if tail.isdigit() else (key, 0, key)


_KIND_ORDER = {"general_spec": 0, "epic_spec": 1, "flow_diagram": 2}


def document_order(document: Document) -> tuple[int, tuple[str, int, str]]:
    """General spec first, then epic specs by epic key, then diagrams (API Contract, list)."""
    return (_KIND_ORDER[document.kind], _natural(document.epic_key or document.key))
