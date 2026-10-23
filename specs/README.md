# Specs: quién hace qué

Cada uno es **dueño de un área de punta a punta** (spec → plan → tasks → código) y **revisa** las specs de otro. Una spec pasa a `Approved` cuando la aprueba su revisor. Casos de uso en [plan/use-cases.md](../plan/use-cases.md); plantilla en [spec-template.md](spec-template.md).

| Spec | Feature | Casos de uso | Responsable | Revisor | Ronda |
|---|---|---|---|---|---|
| [001](001-project-team-setup/spec.md) | Alta de proyecto y equipo | UC-01, UC-02 | sandredev | codigotpx | 1 |
| [002](002-agent-planning-pipeline/spec.md) | Pipeline de agentes de planificación | UC-03 | Mitchz01 | sandredev | 1 |
| [003](003-kanban-board/spec.md) | Tablero kanban y sprints | UC-05, UC-06 | codigotpx | Mitchz01 | 1 |
| [005](005-proposals-approval/spec.md) | Propuestas, aprobación y actividad en vivo | UC-04, UC-14 | sandredev | codigotpx | 1 |
| [004](004-roadmap-architecture-views/spec.md) | Vistas de roadmap, metodología y arquitectura | UC-07 | sandredev | codigotpx | 2 |
| [006](006-generated-specs-diagrams/spec.md) | Specs y diagramas generados | UC-08 | Mitchz01 | sandredev | 2 |
| [007](007-github-integration/spec.md) | Integración con GitHub | UC-09, UC-10, UC-11 | codigotpx | Mitchz01 | 3 |
| [008](008-github-sync-replanning/spec.md) | Sincronización desde GitHub y re-planificación | UC-12, UC-13 | Mitchz01 | sandredev | 3 |

## Áreas

- **sandredev: Configurar y decidir.** El líder arma el proyecto, aprueba o rechaza lo que proponen los agentes y ve la actividad en vivo. También las vistas de lectura del plan.
- **Mitchz01: Agentes.** Todo lo que corre en Gemini/ADK: las etapas del plan, specs y diagramas generados, re-planificación.
- **codigotpx: Trabajar e integrar.** El tablero donde se mueve el trabajo y la conexión con GitHub (issues, code review).

## Orden

- **Ronda 1** = la demo (constitución, principio 1): proyecto → plan → aprobación → tablero. Se escriben primero y en paralelo.
- **Ronda 2** = completa la demo. **Ronda 3** = extras si sobra tiempo.

## Contratos entre specs

Donde una spec depende de otra, los dos dueños acuerdan esto **antes** de aprobar:

| Entre | Qué acordar | Dueños |
|---|---|---|
| 001 → 002 | Qué datos del proyecto y del equipo reciben los agentes | sandredev, Mitchz01 |
| 002 → 005 | Forma de una propuesta por etapa y qué pasa al rechazarla (pregunta abierta 2) | Mitchz01, sandredev |
| 005 → 003 | Qué se crea en el tablero cuando se aprueba el plan (`PlanApplied`) | sandredev, codigotpx |
| 007 → 008 | Qué eventos de GitHub llegan por webhook y cómo mueven las tareas | codigotpx, Mitchz01 |
| 003, 005 | Eventos que se muestran en la actividad en vivo | codigotpx, sandredev |
