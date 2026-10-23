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

## Stack

- **Backend**: Python 3.13, FastAPI, SQLModel (SQLite), Google ADK + Gemini (`gemini-3.5-flash`)
- **Frontend**: React 19 + TypeScript + Vite, Tailwind, dnd-kit, React Router

## Estructura

```
backend/app/
  main.py            app FastAPI
  config.py          env vars (sin API key → MOCK_AGENTS)
  db.py, models.py   SQLModel: Project, Member, Sprint, Task
  agents/            pipeline ADK, esquemas de salida, mock
  routers/           endpoints HTTP
  services/          lógica de negocio (persistir plan, etc.)
backend/tests/
frontend/src/
  api/               cliente HTTP + SSE
  components/        UI reutilizable
  pages/             pantallas (rutas)
  hooks/             hooks
  types/             tipos compartidos (espejo de models.py / schemas.py)
specs/               SDD: constitution, plantillas, features
```

## Comandos

```bash
# backend
cd backend && .venv/Scripts/activate && fastapi dev app/main.py   # :8000
# frontend
cd frontend && npm run dev                                         # :5173, /api → :8000
```

## Convenciones

- Código e identificadores en inglés; textos de UI y specs en español.
- Las salidas de agentes siempre con `output_schema` (Pydantic), nunca texto libre.
- Tipos del front en `src/types` alineados con `backend/app/agents/schemas.py` y `models.py`.
