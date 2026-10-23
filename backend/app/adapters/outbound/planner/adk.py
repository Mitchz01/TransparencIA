"""Adaptador del puerto PlanGenerator con Google ADK + Gemini.

Cada paso de PLAN_STEPS es un LlmAgent con output_schema: lee del state lo que
dejaron los anteriores y guarda su resultado en `output_key`. Un SequentialAgent
los encadena y `generate` emite un PlanEvent por cada inicio y fin.
"""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.domain.entities import Member, Project
from app.domain.plan import PLAN_STEPS, PlanEvent, PlanStep

APP_NAME = "agile-planner"

COMMON = (
    "Sos parte de un equipo de agentes que planifica proyectos de software. "
    "Respondé en el mismo idioma que la descripción del proyecto. "
    "Sé concreto y realista con el tamaño y la experiencia del equipo."
)


@dataclass(frozen=True)
class AgentPrompt:
    inputs: tuple[str, ...]  # claves del state que recibe como contexto
    prompt: str


PROMPTS: dict[str, AgentPrompt] = {
    "analysis": AgentPrompt(
        inputs=("project",),
        prompt=(
            "Analizá el proyecto: objetivos, alcance (qué entra y qué no), riesgos con "
            "mitigación, complejidad y qué roles o skills le faltan al equipo."
        ),
    ),
    "methodology": AgentPrompt(
        inputs=("project", "analysis"),
        prompt=(
            "Elegí la metodología ágil. Si `requested_methodology` es distinto de 'auto', "
            "usá esa y explicá cómo adaptarla a este equipo; si es 'auto', elegí la mejor "
            "según tamaño del equipo, incertidumbre y plazo, y justificá por qué descartaste "
            "las alternativas. Definí ceremonias, duración de iteración y límites WIP."
        ),
    ),
    "architecture": AgentPrompt(
        inputs=("project", "analysis", "methodology"),
        prompt=(
            "Proponé la arquitectura: estilo, componentes, stack por capa y decisiones "
            "clave (tipo ADR). Priorizá tecnologías que el equipo ya conoce según sus skills."
        ),
    ),
    "roadmap": AgentPrompt(
        inputs=("project", "analysis", "methodology", "architecture"),
        prompt=(
            "Armá el roadmap por fases (ej: descubrimiento, MVP, beta, lanzamiento) que "
            "entre en `duration_weeks`. Cada fase tiene objetivo, semanas, entregables y "
            "épicas con key única (EP-1, EP-2, ...)."
        ),
    ),
    "backlog": AgentPrompt(
        inputs=("project", "architecture", "roadmap"),
        prompt=(
            "Descomponé cada épica en historias de usuario (US-1, US-2, ...) con criterios "
            "de aceptación, tipo, story points en Fibonacci, prioridad y el rol del equipo "
            "más adecuado. Entre 3 y 6 historias por épica."
        ),
    ),
    "sprints": AgentPrompt(
        inputs=("project", "methodology", "roadmap", "backlog"),
        prompt=(
            "Repartí las historias en iteraciones de `sprint_length_weeks` respetando el "
            "orden de las fases y la capacidad del equipo (hours_per_week y seniority). "
            "Asigná cada historia a un miembro cuyo rol encaje, usando su `name` exacto. "
            "Toda historia del backlog debe quedar en exactamente una iteración."
        ),
    ),
}


def _instruction(step: PlanStep):
    agent = PROMPTS[step.key]

    def provider(ctx: ReadonlyContext) -> str:
        context = {key: ctx.state.get(key) for key in agent.inputs}
        return (
            f"{COMMON}\n\nTu rol: {step.title}.\n{agent.prompt}\n\n"
            f"Contexto (JSON):\n{json.dumps(context, ensure_ascii=False, indent=2)}"
        )

    return provider


def _project_context(project: Project, members: list[Member]) -> dict[str, Any]:
    """Lo que ven los agentes del proyecto: datos de entrada, sin ids ni estado."""
    data = project.model_dump(
        mode="json", include={"name", "description", "duration_weeks", "requested_methodology"}
    )
    data["members"] = [
        m.model_dump(mode="json", include={"name", "role", "seniority", "hours_per_week", "skills"})
        for m in members
    ]
    return data


class AdkPlanGenerator:
    def __init__(self, model: str) -> None:
        self.model = model

    def build_pipeline(self) -> SequentialAgent:
        return SequentialAgent(
            name="planning_pipeline",
            sub_agents=[
                LlmAgent(
                    name=step.key,
                    model=self.model,
                    description=step.title,
                    instruction=_instruction(step),
                    output_schema=step.schema,
                    output_key=step.key,
                )
                for step in PLAN_STEPS
            ],
        )

    async def generate(self, project: Project, members: list[Member]) -> AsyncIterator[PlanEvent]:
        session_service = InMemorySessionService()
        runner = Runner(app_name=APP_NAME, agent=self.build_pipeline(), session_service=session_service)
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id="planner",
            state={"project": _project_context(project, members)},
        )
        message = types.Content(role="user", parts=[types.Part(text="Generá el plan del proyecto.")])
        index_by_key = {step.key: i for i, step in enumerate(PLAN_STEPS)}

        yield PlanEvent.started(PLAN_STEPS[0])
        async for event in runner.run_async(user_id="planner", session_id=session.id, new_message=message):
            delta = event.actions.state_delta if event.actions else {}
            for key, output in delta.items():
                if key not in index_by_key:
                    continue
                i = index_by_key[key]
                yield PlanEvent.finished(PLAN_STEPS[i], output)
                if i + 1 < len(PLAN_STEPS):
                    yield PlanEvent.started(PLAN_STEPS[i + 1])
