from typing import Literal

from pydantic import BaseModel

DocumentKind = Literal["general_spec", "use_case_spec", "flow_diagram"]


class Document(BaseModel):
    id: int | None = None
    project_id: int
    kind: DocumentKind
    title: str
    # Markdown for specs, Mermaid for diagrams.
    content: str
    version: int = 1
