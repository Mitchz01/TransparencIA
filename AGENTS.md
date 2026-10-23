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

## Arquitectura backend: hexagonal

Puertos y adaptadores. Las dependencias apuntan siempre hacia adentro:

```
adapters  ──▶  application  ──▶  domain
(FastAPI,      (casos de uso,     (entidades, esquemas
 SQLModel,      puertos)           del plan, reglas)
 ADK, mock)
```

- **domain**: solo Python + Pydantic. No importa nada de `application`, `adapters` ni `config`.
- **application**: casos de uso y puertos (`typing.Protocol`). Importa solo `domain`.
- **adapters/inbound**: traducen HTTP a llamadas de casos de uso. No tienen lógica de negocio.
- **adapters/outbound**: implementan los puertos (persistencia SQLModel, planificador ADK, planificador mock).
- **main.py**: raíz de composición. Es el único lugar que elige qué adaptador va en cada puerto (ej: `MOCK_AGENTS` → `MockPlanGenerator`).

Para agregar algo: definir el puerto en `application/ports`, el caso de uso en `application/use_cases`, el adaptador en `adapters/` y conectarlo en `main.py`.

## Estructura

```
backend/app/
  main.py                      raíz de composición (arma y conecta adaptadores)
  config.py                    env vars (sin API key → MOCK_AGENTS)
  domain/
    entities.py                Project, Member, Sprint, Task
    plan.py                    esquemas de salida de cada agente, PLAN_STEPS, PlanEvent
  application/
    ports/                     interfaces: PlanGenerator (repositorios: pendiente)
    use_cases/                 casos de uso (crear proyecto, generar plan, mover tarea…)
    commands.py                datos de entrada/salida de los casos de uso
  adapters/
    inbound/http/              routers FastAPI
    outbound/persistence/      tablas SQLModel, engine, repositorios
    outbound/planner/          adk.py (Gemini) y mock.py
backend/tests/
frontend/src/
  api/               cliente HTTP + SSE
  components/        UI reutilizable
  pages/             pantallas (rutas)
  hooks/             hooks
  types/             tipos compartidos (espejo de domain/ y application/commands.py)
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
- Tipos del front en `src/types` alineados con `backend/app/domain/` y `backend/app/application/commands.py`.
- El núcleo (`domain`, `application`) nunca importa FastAPI, SQLModel, ADK ni `config`.
