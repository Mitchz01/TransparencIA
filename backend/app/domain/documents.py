from typing import Literal

from pydantic import BaseModel

DocumentKind = Literal["general_spec", "use_case_spec", "flow_diagram"]


class Document(BaseModel):
    id: int | None = None
    project_id: int
    kind: DocumentKind
    title: str
    # Markdown para specs, Mermaid para diagramas.
    content: str
    version: int = 1
