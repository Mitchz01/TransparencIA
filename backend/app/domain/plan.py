"""Plan del proyecto: qué produce cada paso y en qué orden.

Es el contrato entre el dominio y cualquier generador de planes. El adaptador
de ADK pasa estos esquemas a Gemini como output_schema, así que la respuesta
llega como JSON validado y se puede persistir directo.
"""

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field

Level = Literal["low", "medium", "high"]


# ---------- Analista ----------


class Risk(BaseModel):
    description: str
    impact: Level
    mitigation: str


class Analysis(BaseModel):
    summary: str = Field(description="Resumen del proyecto en 2-3 oraciones")
    goals: list[str]
    in_scope: list[str]
    out_of_scope: list[str]
    risks: list[Risk]
    complexity: Level
    team_gaps: list[str] = Field(description="Roles o skills que le faltan al equipo")


# ---------- Agile coach ----------


class Ceremony(BaseModel):
    name: str
    frequency: str
    purpose: str


class WipLimit(BaseModel):
    column: Literal["todo", "in_progress", "review"]
    limit: int


class Alternative(BaseModel):
    methodology: str
    why_not: str


class MethodologyDecision(BaseModel):
    methodology: Literal["scrum", "kanban", "scrumban", "xp", "shape_up"]
    rationale: str
    sprint_length_weeks: int = Field(description="Duración de cada iteración en semanas (1-4)")
    ceremonies: list[Ceremony]
    wip_limits: list[WipLimit]
    alternatives: list[Alternative]


# ---------- Arquitecto ----------


class Component(BaseModel):
    name: str
    responsibility: str
    technology: str


class StackItem(BaseModel):
    layer: str
    technology: str
    reason: str


class ArchitectureDecision(BaseModel):
    title: str
    decision: str
    rationale: str


class Architecture(BaseModel):
    style: str = Field(description="Ej: monolito modular, microservicios, serverless")
    summary: str
    components: list[Component]
    stack: list[StackItem]
    decisions: list[ArchitectureDecision]


# ---------- Roadmap ----------


class Epic(BaseModel):
    key: str = Field(description="Identificador corto, ej: EP-1")
    title: str
    description: str


class Phase(BaseModel):
    name: str
    goal: str
    start_week: int
    end_week: int
    deliverables: list[str]
    epics: list[Epic]


class Roadmap(BaseModel):
    phases: list[Phase]


# ---------- Backlog ----------


class Story(BaseModel):
    key: str = Field(description="Identificador corto, ej: US-1")
    epic_key: str
    title: str
    description: str
    acceptance_criteria: list[str]
    type: Literal["feature", "bug", "chore", "spike"]
    points: int = Field(description="Story points en Fibonacci: 1, 2, 3, 5, 8, 13")
    priority: Level
    role: str = Field(description="Rol del equipo más adecuado para la historia")


class Backlog(BaseModel):
    stories: list[Story]


# ---------- Sprint planner ----------


class SprintPlan(BaseModel):
    number: int
    name: str
    goal: str
    phase: str
    story_keys: list[str]


class Assignment(BaseModel):
    story_key: str
    member_name: str


class SprintPlanning(BaseModel):
    sprints: list[SprintPlan]
    assignments: list[Assignment]


# ---------- Pasos y eventos ----------


@dataclass(frozen=True)
class PlanStep:
    key: str  # sección del plan que produce
    title: str  # nombre que ve el usuario
    schema: type[BaseModel]


PLAN_STEPS: tuple[PlanStep, ...] = (
    PlanStep("analysis", "Analista de producto", Analysis),
    PlanStep("methodology", "Agile coach", MethodologyDecision),
    PlanStep("architecture", "Arquitecto de software", Architecture),
    PlanStep("roadmap", "Product manager", Roadmap),
    PlanStep("backlog", "Product owner", Backlog),
    PlanStep("sprints", "Scrum master", SprintPlanning),
)


class PlanEvent(BaseModel):
    """Progreso de la generación: un agente empezó o terminó su paso."""

    type: Literal["agent_started", "agent_finished"]
    agent: str
    title: str
    output: dict[str, Any] | None = None

    @classmethod
    def started(cls, step: PlanStep) -> "PlanEvent":
        return cls(type="agent_started", agent=step.key, title=step.title)

    @classmethod
    def finished(cls, step: PlanStep, output: dict[str, Any]) -> "PlanEvent":
        return cls(type="agent_finished", agent=step.key, title=step.title, output=output)
