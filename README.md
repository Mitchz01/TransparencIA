# Agile Planner

Estilo Jira, pero el plan lo arman agentes: cargás el proyecto y tu equipo (roles, seniority, horas), y un pipeline de agentes con **Google ADK + Gemini** genera la metodología (o usa la que elijas), la arquitectura, un roadmap por fases, el backlog y los sprints, todo volcado en un tablero kanban.

## Pipeline de agentes

`SequentialAgent` en el que cada `LlmAgent` devuelve JSON con un esquema ([plan.py](backend/app/domain/plan.py)). Vive en el adaptador [adk.py](backend/app/adapters/outbound/planner/adk.py), detrás del puerto `PlanGenerator`:

1. **Analista**: objetivos, alcance, riesgos, gaps del equipo
2. **Agile coach**: Scrum / Kanban / Scrumban / XP / Shape Up, con ceremonias y WIP
3. **Arquitecto**: estilo, componentes, stack, ADRs
4. **Product manager**: fases y épicas
5. **Product owner**: historias con puntos y criterios de aceptación
6. **Scrum master**: sprints y asignación por rol y capacidad

## Arquitectura

Backend con **arquitectura hexagonal** (puertos y adaptadores). El dominio y los casos de uso no conocen FastAPI, SQLModel ni ADK; cada tecnología entra por un adaptador. Detalle y reglas en [AGENTS.md](AGENTS.md#arquitectura-backend-hexagonal).

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
py -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env   # poner GOOGLE_API_KEY
fastapi dev app/main.py
```

## Correr el frontend

```bash
cd frontend
npm install
npm i -D tailwindcss @tailwindcss/vite   # pendiente: falló por disco lleno
npm run dev                               # :5173, proxy /api → :8000
```

## TODO

- [ ] Casos de uso + routers: crear proyecto, detalle, `PATCH /tasks/{id}`, `GET /projects/{id}/plan/stream` (SSE)
- [ ] Puertos de repositorio + adaptador SQLModel para persistir la salida del pipeline como Sprint y Task
- [ ] Frontend: alta, progreso de agentes, kanban, roadmap
- [ ] Extra: re-planificar ("se fue un dev, ajustá el sprint")
- [ ] Deploy en Cloud Run
