"""Plan de ejemplo para correr sin API key (MOCK_AGENTS=1).
Respeta los mismos esquemas que devuelven los agentes reales."""

from app.agents import schemas


def _story(key, epic, title, points, role, priority="medium", type_="feature"):
    return {
        "key": key,
        "epic_key": epic,
        "title": title,
        "description": f"Como usuario quiero {title.lower()} para avanzar con el producto.",
        "acceptance_criteria": ["Funciona en desktop y mobile", "Tiene tests básicos"],
        "type": type_,
        "points": points,
        "priority": priority,
        "role": role,
    }


MOCK_PLAN = {
    "analysis": {
        "summary": "Plataforma web para gestionar proyectos con planificación asistida por IA.",
        "goals": ["Tener un MVP demostrable", "Validar con 3 equipos reales"],
        "in_scope": ["Alta de proyectos y equipo", "Tablero kanban", "Roadmap por fases"],
        "out_of_scope": ["Facturación", "App mobile nativa"],
        "risks": [
            {
                "description": "Respuestas del LLM inconsistentes",
                "impact": "high",
                "mitigation": "Usar salidas estructuradas con esquema",
            },
            {
                "description": "Poco tiempo para el front",
                "impact": "medium",
                "mitigation": "Usar componentes prearmados",
            },
        ],
        "complexity": "medium",
        "team_gaps": ["Diseño UX"],
    },
    "methodology": {
        "methodology": "scrumban",
        "rationale": "Equipo chico con alta incertidumbre: iteraciones cortas con flujo continuo y límites WIP.",
        "sprint_length_weeks": 2,
        "ceremonies": [
            {"name": "Daily", "frequency": "Diaria, 15 min", "purpose": "Sincronizar y destrabar"},
            {"name": "Planning", "frequency": "Cada 2 semanas", "purpose": "Elegir el trabajo de la iteración"},
            {"name": "Retro", "frequency": "Cada 2 semanas", "purpose": "Mejorar el proceso"},
        ],
        "wip_limits": [
            {"column": "in_progress", "limit": 3},
            {"column": "review", "limit": 2},
        ],
        "alternatives": [
            {"methodology": "scrum", "why_not": "Demasiadas ceremonias para un equipo de 3-4 personas."},
            {"methodology": "kanban", "why_not": "El equipo necesita cortes de iteración para demos."},
        ],
    },
    "architecture": {
        "style": "Monolito modular",
        "summary": "SPA en React que consume una API FastAPI; los agentes corren en el backend con Google ADK.",
        "components": [
            {"name": "Web app", "responsibility": "UI, tablero y roadmap", "technology": "React + Vite"},
            {"name": "API", "responsibility": "Proyectos, tareas y streaming de agentes", "technology": "FastAPI"},
            {"name": "Agentes", "responsibility": "Generar el plan", "technology": "Google ADK + Gemini"},
            {"name": "Base de datos", "responsibility": "Persistencia", "technology": "SQLite"},
        ],
        "stack": [
            {"layer": "Frontend", "technology": "React + Tailwind", "reason": "Rápido de iterar"},
            {"layer": "Backend", "technology": "FastAPI", "reason": "Async y tipado con Pydantic"},
            {"layer": "IA", "technology": "Gemini", "reason": "Salidas estructuradas nativas"},
        ],
        "decisions": [
            {
                "title": "Salidas estructuradas",
                "decision": "Cada agente devuelve JSON con esquema",
                "rationale": "Se persiste directo como tarjetas",
            }
        ],
    },
    "roadmap": {
        "phases": [
            {
                "name": "Fundaciones",
                "goal": "Base técnica y alta de proyectos",
                "start_week": 1,
                "end_week": 2,
                "deliverables": ["Repo y CI", "Alta de proyecto y equipo"],
                "epics": [
                    {"key": "EP-1", "title": "Setup", "description": "Infraestructura del proyecto"},
                    {"key": "EP-2", "title": "Proyectos y equipo", "description": "CRUD de proyectos y miembros"},
                ],
            },
            {
                "name": "MVP",
                "goal": "Generación del plan y tablero",
                "start_week": 3,
                "end_week": 4,
                "deliverables": ["Pipeline de agentes", "Tablero kanban"],
                "epics": [
                    {"key": "EP-3", "title": "Agentes", "description": "Pipeline que genera el plan"},
                    {"key": "EP-4", "title": "Tablero", "description": "Kanban con drag & drop"},
                ],
            },
            {
                "name": "Beta",
                "goal": "Pulido y feedback",
                "start_week": 5,
                "end_week": 6,
                "deliverables": ["Re-planificación", "Métricas"],
                "epics": [{"key": "EP-5", "title": "Insights", "description": "Velocidad y re-planificación"}],
            },
        ]
    },
    "backlog": {
        "stories": [
            _story("US-1", "EP-1", "Configurar repo y CI", 2, "DevOps", "high", "chore"),
            _story("US-2", "EP-1", "Definir modelo de datos", 3, "Backend", "high"),
            _story("US-3", "EP-2", "Crear proyecto con descripción", 3, "Frontend", "high"),
            _story("US-4", "EP-2", "Cargar miembros y roles", 3, "Frontend", "high"),
            _story("US-5", "EP-3", "Investigar Google ADK", 2, "Backend", "high", "spike"),
            _story("US-6", "EP-3", "Encadenar agentes del plan", 8, "Backend", "high"),
            _story("US-7", "EP-3", "Mostrar progreso de agentes", 5, "Frontend"),
            _story("US-8", "EP-4", "Ver tablero por columnas", 5, "Frontend", "high"),
            _story("US-9", "EP-4", "Mover tarjetas con drag & drop", 3, "Frontend"),
            _story("US-10", "EP-5", "Re-planificar sprint", 8, "Backend", "low"),
            _story("US-11", "EP-5", "Gráfico de velocidad", 5, "Frontend", "low"),
        ]
    },
    "sprints": {
        "sprints": [
            {"number": 1, "name": "Sprint 1", "goal": "Base lista", "phase": "Fundaciones",
             "story_keys": ["US-1", "US-2", "US-3", "US-4"]},
            {"number": 2, "name": "Sprint 2", "goal": "Plan generado por agentes", "phase": "MVP",
             "story_keys": ["US-5", "US-6", "US-7", "US-8", "US-9"]},
            {"number": 3, "name": "Sprint 3", "goal": "Beta", "phase": "Beta",
             "story_keys": ["US-10", "US-11"]},
        ],
        # Los nombres no coinciden con el equipo real: persist cae al match por rol.
        "assignments": [],
    },
}

# Falla rápido si el mock se desalinea de los esquemas.
schemas.Analysis.model_validate(MOCK_PLAN["analysis"])
schemas.MethodologyDecision.model_validate(MOCK_PLAN["methodology"])
schemas.Architecture.model_validate(MOCK_PLAN["architecture"])
schemas.Roadmap.model_validate(MOCK_PLAN["roadmap"])
schemas.Backlog.model_validate(MOCK_PLAN["backlog"])
schemas.SprintPlanning.model_validate(MOCK_PLAN["sprints"])
