# Plan técnico: Arquitectura hexagonal

- **Estado**: Aprobado
- **Alcance**: estructura de carpetas, capas y reglas de dependencia de backend y frontend. No implementa features; define dónde va a vivir cada una.

- **Contexto del producto**: [context.md](context.md). Este documento asume que ya lo leíste.

## Por qué hexagonal

El producto se conecta con varios sistemas externos (LLM, base de datos, GitHub, UI, webhooks). Por eso elegimos hexagonal: el núcleo (proyectos, planes, aprobaciones) tiene que sobrevivir a cambios de LLM (Gemini o mock), de proveedor de código (GitHub, después GitLab o Jira) y de canal de entrada (UI, webhooks, jobs), sin reescribirse.

## Enfoque

- **Dominio**: entidades y reglas del negocio. No conoce FastAPI, SQLModel, ADK ni GitHub.
- **Aplicación**: casos de uso más los **puertos** (interfaces) que necesitan del exterior.
- **Adaptadores**: implementaciones concretas.
  - **De entrada** (quién nos llama): API HTTP + SSE, webhooks de GitHub.
  - **De salida** (a quién llamamos): SQLite, agentes ADK/Gemini, GitHub y sus mocks.
- **Composition root** (`main.py`): el único lugar que conoce todo y conecta puertos con adaptadores.

Regla de dependencia: `adapters → application → domain`. Nunca al revés.

```
   ┌────────────────────────── adapters/inbound ──────────────────────────┐
   │   http/ (UI: REST + SSE)            webhooks/ (GitHub: PR, issue)     │
   └──────────────────────────────────┬───────────────────────────────────┘
                                      ▼
   ┌───────────────────────────── application ────────────────────────────┐
   │   use_cases/  ──usan──▶  ports/ (Protocol)                            │
   └─────────┬────────────────────────────────────────────▲───────────────┘
             ▼                                            │ implementan
   ┌──────── domain ────────┐   ┌──────────────── adapters/outbound ────────────────┐
   │ proyecto, equipo,      │   │ persistence/  SQLModel + SQLite                    │
   │ tablero, plan,         │   │ agents/       ADK + Gemini  ·  mock                │
   │ propuestas, docs,      │   │ code_host/    GitHub (REST) ·  fake                │
   │ eventos                │   │ events/       bus en memoria → SSE                 │
   └────────────────────────┘   └────────────────────────────────────────────────────┘
```

## Conceptos de dominio nuevos que impone el contexto

| Concepto | Por qué existe |
|---|---|
| **Proposal** (propuesta) | Toda salida de un agente (metodología, roadmap, backlog, sprints, docs, re-planificación, acción en GitHub) se guarda como `Proposal` con `status: pending → approved / adjusted / rejected`. Nada se aplica al tablero ni a GitHub sin aprobación. Es el corazón de "todo pasa por el usuario". |
| **Checklist** en `Task` | Ítems tildables por tarea, generados por el agente y editables. |
| **Document** | Spec general, specs por caso de uso y diagramas (fuente **Mermaid**, se renderiza en el front). Versionados y con aprobación. |
| **ExternalLink** | Vínculo `Task ↔ issue/PR` de GitHub (número, url, estado). Permite sincronizar en ambos sentidos. |
| **Objective** | Meta medible del proyecto (de la fase o del sprint); se cierra cuando se cierran sus tareas o PRs. |
| **DomainEvent** | `AgentStarted`, `ProposalCreated`, `ProposalApproved`, `TaskStatusChanged`, `PullRequestMerged`... Alimentan el SSE (UI en vivo) y disparan reacciones (re-planificar, cerrar objetivos). |

## Backend

### Estructura

```
backend/app/
  main.py                           composition root
  config.py                         env vars (+ GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET, MOCK_GITHUB)

  domain/                           Python puro + Pydantic, sin I/O
    project.py                      Project, Member, Objective, RequestedMethodology
    board.py                        Sprint, Task, ChecklistItem, TaskStatus, Priority
    plan.py                         Analysis, MethodologyDecision, Architecture, Roadmap,
                                    Backlog, SprintPlanning  (hoy agents/schemas.py) + PLANNING_STAGES
    documents.py                    Document (spec general, spec de caso de uso, diagrama)
    proposals.py                    Proposal, ProposalKind, ProposalStatus, reglas de transición
    integrations.py                 ExternalLink, IssueRef, PullRequestRef
    events.py                       DomainEvent y subclases
    errors.py                       ProjectNotFound, ProposalAlreadyResolved, ...

  application/
    ports/
      repositories.py               ProjectRepository, TaskRepository, ProposalRepository,
                                    DocumentRepository (Protocol)
      unit_of_work.py               UnitOfWork: repos + commit/rollback
      agents.py                     PlanningAgents: run_stage(stage, context). Las etapas (clave,
                                    agente, esquema, inputs) viven en domain/plan.py (PLANNING_STAGES);
                                    specs, diagramas y replan se suman como etapas nuevas
      code_host.py                  CodeHost: create_issue, open_pull_request, request_review,
                                    close_issue, get_pull_request
      event_bus.py                  EventBus: publish / subscribe (para SSE)
    use_cases/
      projects/                     create_project, get_project, list_projects, update_team
      planning/                     start_planning, run_planning_step, generate_documents, replan
      proposals/                    approve_proposal, adjust_proposal, reject_proposal
                                    (aprobar = aplicar la propuesta al tablero, a los docs o a GitHub)
      board/                        update_task, toggle_checklist_item, move_task
      integrations/                 connect_repository, sync_task_to_github,
                                    handle_pull_request_event, handle_issue_event
    dto.py                          payloads de entrada y salida de los casos de uso

  adapters/
    inbound/
      http/
        dependencies.py             Depends() que arman los casos de uso
        projects.py                 /api/projects
        planning.py                 /api/projects/{id}/planning (+ SSE de eventos)
        proposals.py                /api/proposals/{id}/approve|adjust|reject
        board.py                    /api/tasks
        documents.py                /api/projects/{id}/documents
        errors.py                   domain/errors → HTTP
      webhooks/
        github.py                   /webhooks/github: valida firma HMAC → caso de uso
    outbound/
      persistence/
        db.py                       engine, create_db, Session
        tables.py                   tablas SQLModel
        mappers.py                  tabla ↔ entidad
        repositories.py             Sql*Repository
        unit_of_work.py             SqlUnitOfWork
      agents/
        adk/
          prompts.py                instrucciones por agente
          agents.py                 AdkPlanningAgents (implementa PlanningAgents): un LlmAgent
                                    con output_schema por etapa
        mock/
          data.py                   MOCK_PLAN (+ docs y diagramas de ejemplo)
          agents.py                 MockPlanningAgents
      code_host/
        github/
          client.py                 cliente REST (httpx)
          code_host.py              GitHubCodeHost (implementa CodeHost)
        fake.py                     FakeCodeHost: registra las llamadas en memoria (dev y tests)
      events/
        in_memory_bus.py            InMemoryEventBus (asyncio.Queue por suscriptor)

backend/tests/
  unit/domain/                      reglas (transiciones de Proposal, checklist, objetivos)
  unit/application/                 casos de uso con fakes en memoria
  integration/adapters/             repos sobre SQLite en memoria, routers y webhook con TestClient
  architecture/test_layers.py       falla si domain/ o application/ importan fastapi,
                                    sqlmodel, google.adk o httpx
```

### Flujo clave: planificación con aprobación

Hoy el pipeline es un `SequentialAgent` que corre las 6 etapas de corrido. Con aprobación humana se **parte por etapas**:

```
start_planning ──▶ run_planning_step(analysis) ──▶ Proposal(pending) ──▶ SSE a la UI
                                                         │
                         usuario: approve / adjust ◀─────┘
                                     │
                                     ▼
              run_planning_step(siguiente etapa, con lo aprobado como contexto)
                                     │
                                    ...
              plan_sprints aprobado ──▶ se aplica al tablero (Sprint, Task, Checklist)
              write_specs / draw_diagrams aprobados ──▶ Document
```

- Cada etapa es una llamada al puerto `PlanningAgents`; el caso de uso decide cuál sigue. El estado vive en la DB (`Proposal`), no en la sesión de ADK, así que se puede cerrar el navegador y volver.
- `adjust` guarda la versión editada por el usuario y la pasa como contexto a la etapa siguiente ("El usuario manda").
- **Auto-aprobar** (`Project.auto_approve`, se elige al crear el proyecto y se puede cambiar): las propuestas se crean igual, quedan auditadas y visibles con su justificación, pero pasan solas a `approved` y el pipeline sigue sin pausa. El usuario puede revisarlas después y pedir un ajuste, que entra como re-planificación.

### Flujo clave: sincronización con GitHub

```
Tarea aprobada ──▶ Proposal(kind=github_action, "crear issue #") ──▶ aprobación ──▶ CodeHost.create_issue
                                                                                      └▶ ExternalLink

GitHub ──webhook──▶ handle_pull_request_event
                      ├─ PR abierto que referencia la issue → Task: in_progress / review
                      ├─ PR mergeado → Task: done, tilda el checklist, evalúa el Objective
                      └─ desvío (atraso, scope nuevo) → PlanningAgents.run_stage(replan) → Proposal(pending)
```

Las acciones que **escriben** en GitHub pasan por propuesta (son visibles para terceros); las que **leen** o actualizan el tablero desde un webhook se aplican directo y quedan registradas como evento.

- **Un solo repo por proyecto**: `Project.repository` (`owner/name`). `CodeHost` recibe ese repo; no hay ruteo entre repos.
- **Nuestro tablero es la fuente de verdad**: las issues de GitHub son un espejo de las tareas. Desde GitHub sólo entran los cambios de estado (PR abierto, mergeado, issue cerrada); si alguien edita el título o el cuerpo de una issue, no se pisa la tarea. No sincronizamos con GitHub Projects.

### Mapeo desde la estructura actual

| Hoy | Pasa a |
|---|---|
| `app/models.py` (tablas `table=True`) | `adapters/outbound/persistence/tables.py` |
| `app/models.py` (entidades / Literals) | `domain/project.py`, `domain/board.py` |
| `app/models.py` (payloads API) | `application/dto.py` |
| `app/agents/schemas.py` | `domain/plan.py` |
| `app/agents/pipeline.py` | `adapters/outbound/agents/adk/{prompts,agents}.py` (por etapas) |
| `app/agents/mock.py` | `adapters/outbound/agents/mock/{data,agents}.py` |
| `app/db.py` | `adapters/outbound/persistence/db.py` |
| `app/routers/` | `adapters/inbound/http/` |
| `app/services/` | `application/use_cases/` |

## Frontend

Mismo patrón, en versión liviana: la UI no llama a `fetch` directamente sino a puertos, así se puede reemplazar el backend por un fake en demos y tests.

```
frontend/src/
  main.tsx
  app/
    App.tsx, routes.tsx             router + layout
    container.tsx                   composition root: contexto con los gateways concretos

  domain/                           TS puro: tipos espejo de backend/app/domain/*.py
    project.ts, board.ts, plan.ts, proposals.ts, documents.ts, integrations.ts, events.ts
    rules.ts                        reglas puras (límites WIP, capacidad, progreso del checklist)

  application/
    ports.ts                        ProjectGateway, PlanningGateway, ProposalGateway,
                                    BoardGateway, DocumentGateway, EventStream
    use-cases/                      hooks: useCreateProject, usePlanning, useApproveProposal,
                                    useMoveTask, useProjectEvents

  adapters/
    http/                           client.ts, sse.ts, *Gateway.ts (implementan los puertos)
    fake/                           gateways en memoria para desarrollo sin backend

  ui/
    pages/                          NewProject, Planning (propuestas para aprobar), Board,
                                    Roadmap, Documents, Integrations
    components/
      board/                        Kanban (dnd-kit), TaskCard, Checklist
      proposals/                    ProposalCard, DiffView, ApproveBar
      roadmap/                      timeline por fases
      diagrams/                     MermaidView
    styles/
```

Regla: `ui → application → domain`. `adapters` implementa `application/ports` y sólo `app/container.tsx` importa `adapters`.

## Decisiones y alternativas

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Pydantic permitido en `domain/` | Dataclasses + duplicar los esquemas en el adaptador ADK | `output_schema` de ADK necesita Pydantic; duplicarlo viola "Simple antes que escalable". |
| Tablas SQLModel separadas de las entidades, con mappers | Tablas SQLModel como entidades | Evita atar el dominio a la DB; el costo son mappers chicos. |
| `Proposal` como entidad de dominio de primera clase | Flag "aprobado" en cada entidad | Un único mecanismo de aprobación para todo: plan, docs, re-planificación y acciones en GitHub. Queda auditado. |
| Pipeline partido por etapas, con el estado en la DB | Un `SequentialAgent` de corrido | Hace falta una pausa humana entre etapas, y una sesión de ADK en memoria no sobrevive horas. |
| Puerto `CodeHost` genérico | Llamar a GitHub desde los casos de uso | Habilita GitLab o Jira después, y un `FakeCodeHost` para la demo sin token. |
| Escrituras a GitHub siempre con propuesta | Automatizar todo | Son acciones visibles para terceros; principio "El usuario manda". |
| Diagramas en Mermaid (texto) | Imágenes generadas | El LLM lo genera bien con esquema, es editable por el usuario y se versiona. |
| `EventBus` en memoria | Redis o PubSub | Monolito + SQLite ("Simple antes que escalable"); el puerto permite cambiarlo en Cloud Run. |
| Auto-aprobar configurable por proyecto | Aprobación siempre manual | Demo ágil; las propuestas igual quedan auditadas y se pueden ajustar después. |
| Un repo de GitHub por proyecto | Varios repos por proyecto | Simplifica `CodeHost`, los webhooks y los vínculos tarea ↔ issue. |
| Nuestro tablero como fuente de verdad | Sincronizar con GitHub Projects | Evita conflictos bidireccionales; GitHub sólo aporta cambios de estado. |
| Un solo método `run_stage` con etapas declaradas en el dominio | Un método por etapa en el puerto | Agregar una etapa (specs, diagramas, replan) es sumar una entrada a `PLANNING_STAGES` + su prompt, sin tocar el puerto ni los adaptadores. |
| Puertos con `typing.Protocol` | `ABC` | Los fakes no necesitan heredar. |
| Test de arquitectura casero | `import-linter` | Cero dependencias nuevas. |

## Pasos de migración (sólo la estructura)

1. Crear las carpetas de backend y frontend (`__init__.py` / `.gitkeep`).
2. Mover `agents/schemas.py` → `domain/plan.py` y extraer entidades a `domain/`.
3. Separar `models.py` en `domain/`, `application/dto.py` y `persistence/tables.py`.
4. Mover `db.py` a `persistence/` y crear los puertos de repositorios + `SqlUnitOfWork`.
5. Partir `agents/pipeline.py` en `AdkPlanningAgents` por etapas y `agents/mock.py` en `MockPlanningAgents`.
6. Dejar los puertos `CodeHost` y `EventBus` con sus fakes (GitHub real queda para su spec).
7. `main.py` como composition root; borrar `routers/`, `services/`, `agents/`, `models.py`, `db.py`.
8. Front: mover a `app/`, `domain/`, `application/`, `adapters/`, `ui/`; borrar las carpetas viejas vacías.
9. Agregar `tests/architecture/test_layers.py`.
10. Actualizar `AGENTS.md`, `README.md`, `specs/_templates/plan.md` ("Dominio / Puertos / Adaptadores" en lugar de "cambios en `models.py`") y la constitución (ver abajo).
11. Verificar: `/api/health` responde, el test de capas pasa y `npm run build` compila.

## Impacto en specs y constitución

Specs nuevas a escribir (después de aprobar este plan):

| ID | Feature |
|---|---|
| 005 | Propuestas y aprobación del usuario |
| 006 | Specs y diagramas generados (spec general, por caso de uso, flujos) |
| 007 | Integración con GitHub (issues, PRs, reviews) |
| 008 | Sincronización dinámica y re-planificación |

La 002 (pipeline) cambia: pasa a ser por etapas con aprobación.

Constitución: agregar **"8. Nada se aplica sin aprobación: toda decisión de un agente es una propuesta"** y matizar el punto 5 ("sin auth"): GitHub necesita un token por proyecto.

## Riesgos

- **Más archivos para un proyecto chico**: mitigado con un archivo por agregado, no por clase.
- **Aprobar etapa por etapa puede hacer lenta la demo**: se mitiga con el modo auto-aprobar.
- **Webhooks en local**: GitHub no llega a `localhost`; usar `FakeCodeHost` + un endpoint para simular eventos, o un túnel (smee.io o similar).
- **Tokens de GitHub**: arrancar con un PAT en `.env`; migrar a GitHub App cuando haya multiusuario.

Las decisiones de producto (auto-aprobar, un solo repo, nuestro tablero como fuente de verdad) están en [context.md](context.md#decisiones-tomadas); acá sólo figuran sus consecuencias técnicas.

## Estado de la migración (2026-10-23)

Hecho:
- Estructura de carpetas de backend y frontend.
- Dominio (`project`, `board`, `plan` + `PLANNING_STAGES`, `proposals` con sus transiciones, `documents`, `integrations`, `events`, `errors`).
- Puertos: repositorios, `UnitOfWork`, `PlanningAgents`, `CodeHost`, `EventBus`.
- Adaptadores: persistencia SQLModel (proyecto + equipo, sprints, tareas con checklist), `AdkPlanningAgents` y `MockPlanningAgents` por etapa, `FakeCodeHost`, `InMemoryEventBus`, HTTP (`/api/health` + errores de dominio → HTTP).
- Caso de uso `RunPlanning`: mismo comportamiento que el pipeline anterior (todas las etapas de corrido).
- Tests: capas, transiciones de `Proposal`, `RunPlanning`, persistencia y wiring HTTP.
- Front: carpetas nuevas y tipos espejo en `domain/`.

Queda para las specs de cada feature: routers de proyectos, planning, propuestas, tablero y documentos; repos y tablas de `Proposal`, `Document`, `Objective` y `ExternalLink`; `GitHubCodeHost` y el webhook; gateways, `container.tsx` y pantallas del front.
