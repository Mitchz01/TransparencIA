COMMON = (
    "Sos parte de un equipo de agentes que planifica proyectos de software. "
    "Respondé en el mismo idioma que la descripción del proyecto. "
    "Sé concreto y realista con el tamaño y la experiencia del equipo."
)

# Clave: PlanningStage.key
PROMPTS: dict[str, str] = {
    "analysis": (
        "Analizá el proyecto: objetivos, alcance (qué entra y qué no), riesgos con "
        "mitigación, complejidad y qué roles o skills le faltan al equipo."
    ),
    "methodology": (
        "Elegí la metodología ágil. Si `requested_methodology` es distinto de 'auto', "
        "usá esa y explicá cómo adaptarla a este equipo; si es 'auto', elegí la mejor "
        "según tamaño del equipo, incertidumbre y plazo, y justificá por qué descartaste "
        "las alternativas. Definí ceremonias, duración de iteración y límites WIP."
    ),
    "architecture": (
        "Proponé la arquitectura: estilo, componentes, stack por capa y decisiones "
        "clave (tipo ADR). Priorizá tecnologías que el equipo ya conoce según sus skills."
    ),
    "roadmap": (
        "Armá el roadmap por fases (ej: descubrimiento, MVP, beta, lanzamiento) que "
        "entre en `duration_weeks`. Cada fase tiene objetivo, semanas, entregables y "
        "épicas con key única (EP-1, EP-2, ...)."
    ),
    "backlog": (
        "Descomponé cada épica en historias de usuario (US-1, US-2, ...) con criterios "
        "de aceptación, tipo, story points en Fibonacci, prioridad y el rol del equipo "
        "más adecuado. Entre 3 y 6 historias por épica."
    ),
    "sprints": (
        "Repartí las historias en iteraciones de `sprint_length_weeks` respetando el "
        "orden de las fases y la capacidad del equipo (hours_per_week y seniority). "
        "Asigná cada historia a un miembro cuyo rol encaje, usando su `name` exacto. "
        "Toda historia del backlog debe quedar en exactamente una iteración."
    ),
}
