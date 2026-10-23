# Agile Planner

Estilo Jira, pero el plan lo arman agentes: cargás el proyecto y tu equipo (roles, seniority, horas), y un pipeline de agentes con **Google ADK + Gemini** genera la metodología (o usa la que elijas), la arquitectura, un roadmap por fases, el backlog y los sprints, todo volcado en un tablero kanban.

## Pipeline de agentes

Etapas en orden; cada una es un `LlmAgent` que devuelve JSON con un esquema ([domain/plan.py](backend/app/domain/plan.py)):

1. **Analista**: objetivos, alcance, riesgos, gaps del equipo
2. **Agile coach**: Scrum / Kanban / Scrumban / XP / Shape Up, con ceremonias y WIP
3. **Arquitecto**: estilo, componentes, stack, ADRs
4. **Product manager**: fases y épicas
5. **Product owner**: historias con puntos y criterios de aceptación
6. **Scrum master**: sprints y asignación por rol y capacidad

## Contexto y arquitectura

- [plan/context.md](plan/context.md): qué es el producto y cómo se usa (sin detalles técnicos).
- [plan/hexagonal-architecture.md](plan/hexagonal-architecture.md): arquitectura hexagonal (puertos y adaptadores), carpetas y decisiones.
- [plan/use-cases.md](plan/use-cases.md): casos de uso con diagramas de cómo se implementa cada uno.

## Cómo trabajamos: SDD

Spec → Plan → Tasks → Código. Cada feature vive en `specs/NNN-feature/` con `spec.md`, `plan.md` y `tasks.md` (plantillas en [specs/_templates](specs/_templates/), principios en [specs/constitution.md](specs/constitution.md)). Las reglas para los asistentes de IA, la estructura y los comandos están en [AGENTS.md](AGENTS.md), que también leen [CLAUDE.md](CLAUDE.md) y [GEMINI.md](GEMINI.md).

| Feature | Carpeta |
|---|---|
| Alta de proyecto y equipo | [specs/001-project-team-setup](specs/001-project-team-setup/) |
| Pipeline de agentes | [specs/002-agent-planning-pipeline](specs/002-agent-planning-pipeline/) |
| Tablero kanban y sprints | [specs/003-kanban-board](specs/003-kanban-board/) |
| Roadmap, metodología y arquitectura | [specs/004-roadmap-architecture-views](specs/004-roadmap-architecture-views/) |

## Correr el backend

```bash
cd backend
py -m venv .venv && .venv/Scripts/activate   # Linux/macOS: python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # poner GOOGLE_API_KEY
fastapi dev app/main.py
pytest                 # tests (incluye el de capas de la arquitectura)
```

## Correr el frontend

```bash
cd frontend
npm install
npm i -D tailwindcss @tailwindcss/vite   # pendiente: falló por disco lleno
npm run dev                               # :5173, proxy /api → :8000
```

## TODO

- [ ] Routers (`adapters/inbound/http`): crear proyecto, detalle, `PATCH /tasks/{id}`, SSE del planning
- [ ] Propuestas y aprobación por etapa (spec 005)
- [ ] Persistir el plan aprobado como Sprint y Task
- [ ] Specs y diagramas generados (006), GitHub (007), sincronización y re-planificación (008)
- [ ] Frontend: alta, progreso de agentes, kanban, roadmap
- [ ] Extra: re-planificar ("se fue un dev, ajustá el sprint")
- [ ] Deploy en Cloud Run
