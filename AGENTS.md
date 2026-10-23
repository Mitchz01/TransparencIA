# Instrucciones para agentes de IA

Este repo usa **Spec-Driven Development (SDD)**. Vale para cualquier asistente (Claude Code, Gemini CLI, Copilot, Cursor).

## Flujo obligatorio

1. **Spec** → `specs/NNN-feature/spec.md`: qué y por qué (usuario, historias, criterios de aceptación). Nada técnico.
2. **Plan** → `specs/NNN-feature/plan.md`: cómo (endpoints, modelos, componentes, decisiones).
3. **Tasks** → `specs/NNN-feature/tasks.md`: checklist ordenada, cada tarea chica y verificable.
4. **Implementar** una tarea a la vez y marcarla `[x]` en `tasks.md`.

Reglas:
- No escribir código de una feature sin `spec.md` y `plan.md` aprobados (`Estado: Aprobado`).
- Si la implementación contradice la spec, se actualiza la spec primero.
- Respetar [specs/constitution.md](specs/constitution.md).
- Plantillas en [specs/_templates/](specs/_templates/).
- Para trabajo de frontend, seguir las skills de [.claude/skills/](.claude/skills/README.md) (diseño visual, composición y rendimiento en React, auditoría de UI).

## Stack

- **Backend**: Python 3.13, FastAPI, SQLModel (SQLite), Google ADK + Gemini (`gemini-3.5-flash`)
- **Frontend**: React 19 + TypeScript + Vite, Tailwind, dnd-kit, React Router

## Estructura (arquitectura hexagonal)

Contexto del producto en [plan/context.md](plan/context.md); arquitectura y decisiones en [plan/hexagonal-architecture.md](plan/hexagonal-architecture.md).

Regla de dependencia: `adapters → application → domain`, nunca al revés (lo verifica `tests/architecture/test_layers.py`).

```
backend/app/
  main.py              composition root: elige adaptadores (mock o real) y monta routers
  config.py            env vars (sin API key → MOCK_AGENTS, sin GITHUB_TOKEN → MOCK_GITHUB)
  domain/              entidades, esquemas del plan (PLANNING_STAGES), propuestas, eventos. Sin I/O
  application/
    ports/             interfaces (Protocol): repos, UnitOfWork, PlanningAgents, CodeHost, EventBus
    use_cases/         un módulo por caso de uso, agrupados por feature
    dto.py             entradas/salidas de los casos de uso
  adapters/
    inbound/http/      routers FastAPI + SSE
    inbound/webhooks/  webhooks de GitHub
    outbound/persistence/  SQLModel: tablas, mappers, repos, UnitOfWork
    outbound/agents/   adk/ (Gemini) y mock/
    outbound/code_host/    github/ y fake
    outbound/events/   bus de eventos en memoria
backend/tests/         unit/ (domain, application), integration/adapters/, architecture/
frontend/src/
  app/                 App, rutas, composition root (container)
  domain/              tipos espejo de backend/app/domain + reglas puras
  application/         ports.ts (gateways) + use-cases/ (hooks)
  adapters/            http/ (backend real) y fake/ (sin backend)
  ui/                  pages/, components/, styles/, assets/
plan/                  contexto del producto y arquitectura
specs/               SDD: constitution, plantillas, features
```

## Comandos

```bash
# backend
cd backend && .venv/Scripts/activate && fastapi dev app/main.py   # :8000 (Linux/macOS: .venv/bin/activate)
cd backend && pip install -r requirements-dev.txt && pytest       # tests
# frontend
cd frontend && npm run dev                                         # :5173, /api → :8000
```

## Convenciones

- Código e identificadores en inglés; textos de UI y specs en español.
- Las salidas de agentes siempre con `output_schema` (Pydantic), nunca texto libre.
- Tipos del front en `src/domain` alineados con `backend/app/domain/`.
- Nombres de carpetas y archivos siempre en inglés (también en `plan/` y `specs/`); el contenido de docs y la UI, en español.
- Nada del exterior (FastAPI, SQLModel, ADK, GitHub) se importa en `domain/` ni en `application/`: se agrega un puerto y un adaptador.
- Las tablas SQLModel son del adaptador de persistencia; el resto del código usa las entidades de `domain/`.
