# Contexto del producto

Qué es Agile Planner, para quién es y cómo se usa. Sin detalles técnicos: para eso están [hexagonal-architecture.md](hexagonal-architecture.md) y [use-cases.md](use-cases.md).

## Qué es

Un sistema tipo Jira que organiza equipos de desarrollo de software, orquestado por agentes de IA. El líder carga a su equipo y lo que quieren construir, y los agentes arman todo el plan de trabajo, lo mantienen actualizado mientras avanza el desarrollo y se conectan con las herramientas que usa el equipo, como GitHub.

## Para quién

- **Líder de equipo** (o quien use la herramienta): define el equipo y la meta, y aprueba o ajusta lo que proponen los agentes.
- **Miembros del equipo**: trabajan sobre el tablero y en GitHub; el sistema se actualiza solo con su avance.

## Qué hace

1. **Definir el equipo y la meta**: quiénes son, qué rol cumple cada uno (con seniority y horas disponibles) y qué producto u objetivo buscan.
2. **Elegir la metodología**: los agentes recomiendan la más adecuada (Scrum, Kanban, Scrumban, XP, Shape Up) y explican por qué. Si el usuario ya eligió una, la respetan y la adaptan al equipo.
3. **Armar el trabajo**: sprints, tareas o tarjetas con prioridad, asignación según el rol de cada miembro y un checklist en cada tarea.
4. **Documentar**: roadmap gráfico por fases, diagramas de flujo, una spec general del producto y specs por caso de uso.
5. **Conectarse con GitHub**: abrir issues, PRs y pedidos de code review, e ir cerrando tareas y objetivos a medida que el código avanza.
6. **Mantenerse vivo**: el plan se actualiza con el desarrollo real. Si hay atrasos o aparece trabajo nuevo, los agentes proponen re-planificar.

## Principio central: todo pasa por el usuario

Cada decisión de los agentes llega como una **propuesta** con su justificación: qué decidieron y por qué. El usuario la **aprueba**, la **ajusta** o la **rechaza**, y nada se aplica al tablero ni a GitHub antes de eso.

**Auto-aprobar**: cada proyecto puede activarlo para avanzar rápido (por ejemplo, en una demo). Las propuestas siguen quedando registradas con su justificación y el usuario puede revisarlas y pedir cambios después.

## Cómo se usa (recorrido típico)

1. El líder crea el proyecto: describe el producto, carga el equipo y, si quiere, elige la metodología.
2. Los agentes trabajan por etapas: análisis → metodología → arquitectura → roadmap → backlog → sprints → specs y diagramas. El usuario ve en vivo qué agente está trabajando.
3. Al terminar cada etapa, el usuario aprueba o ajusta la propuesta (o se aprueba sola si activó auto-aprobar).
4. Con el plan aprobado, aparece el tablero con sprints y tareas, junto con el roadmap y los documentos.
5. El líder conecta el repo de GitHub; las tareas aprobadas se convierten en issues.
6. A medida que el equipo abre y mergea PRs, las tareas avanzan solas en el tablero, se tildan los checklists y se cierran los objetivos.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Aprobación | Manual por defecto, con opción de auto-aprobar en cada proyecto. |
| GitHub | Cada proyecto se conecta con **un solo repo**. |
| Fuente de verdad | **Nuestro tablero.** GitHub refleja las tareas; desde GitHub sólo llega el avance (PR abierto, mergeado, issue cerrada). No se sincroniza con GitHub Projects. |

## Conceptos

| Término | Qué significa |
|---|---|
| Propuesta | Algo que decidió un agente y espera la aprobación del usuario. |
| Objetivo | Meta concreta de una fase o sprint; se cierra cuando se completan sus tareas. |
| Checklist | Pasos concretos dentro de una tarea, que se tildan a medida que se hacen. |
| Spec | Documento que describe qué hace el producto (general) o un caso de uso puntual. |
| Re-planificación | Propuesta de los agentes para ajustar el plan cuando la realidad se desvía. |
