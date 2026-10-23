# Feature Specification: 002 · Pipeline de agentes de planificación

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: Mitchz01  
**Reviewer**: sandredev  
**Use cases**: UC-03 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar el plan por etapas (Priority: P1)

Cuando el líder termina de crear el proyecto y el equipo, un grupo de agentes arma el plan de trabajo en seis etapas, siempre en este orden: **análisis → metodología → arquitectura → roadmap → backlog → sprints**. Cada etapa está a cargo de un agente con un rol (analista, agile coach, arquitecto, product manager, product owner, scrum master). Al terminar, cada etapa deja una **propuesta** con lo que decidió y por qué. La etapa siguiente arranca recién cuando se aprueba la anterior.

**Why this priority**: es el corazón del producto y lo que se muestra en la demo. Sin esto no hay tablero, roadmap ni documentos.

**Independent Test**: crear un proyecto con auto-aprobar activado y verificar que, sin otra intervención, quedan seis propuestas aprobadas en orden, cada una con su justificación.

**Acceptance Scenarios**:

1. **Scenario**: Arranque del plan
   - **Given** un proyecto recién creado con al menos un miembro
   - **When** se inicia la planificación
   - **Then** el proyecto pasa a "planificando", empieza la etapa de análisis y se avisa qué agente está trabajando

2. **Scenario**: Avance etapa por etapa
   - **Given** la propuesta de análisis está pendiente
   - **When** el líder la aprueba
   - **Then** empieza la etapa de metodología, que usa el análisis aprobado como contexto

3. **Scenario**: Contenido ajustado por el líder
   - **Given** el líder ajustó la propuesta de arquitectura antes de aprobarla
   - **When** corre la etapa de roadmap
   - **Then** el roadmap usa la versión ajustada, no la original del agente

4. **Scenario**: Plan completo con auto-aprobar
   - **Given** un proyecto con auto-aprobar activado
   - **When** se inicia la planificación
   - **Then** las seis etapas corren seguidas, cada propuesta queda registrada como aprobada automáticamente y al final se dispara la carga del tablero (spec 003)

---

### User Story 2 - Metodología recomendada o respetada (Priority: P1)

Si el líder no eligió metodología, el agile coach recomienda la más adecuada (Scrum, Kanban, Scrumban, XP o Shape Up) según el tamaño del equipo, la incertidumbre y el plazo, y explica por qué descartó las otras. Si el líder ya eligió una, el agente la respeta y explica cómo adaptarla a ese equipo.

**Why this priority**: es el diferencial frente a Jira y uno de los principios del producto ("El usuario manda").

**Independent Test**: correr la planificación dos veces con el mismo proyecto, una con metodología "automática" y otra con "Kanban", y comparar las propuestas de metodología.

**Acceptance Scenarios**:

1. **Scenario**: Recomendación automática
   - **Given** un proyecto sin metodología elegida
   - **When** termina la etapa de metodología
   - **Then** la propuesta indica la metodología elegida, la justificación, las ceremonias, la duración de iteración, los límites WIP y al menos dos alternativas descartadas con su motivo

2. **Scenario**: Metodología elegida por el líder
   - **Given** un proyecto en el que el líder eligió Kanban
   - **When** termina la etapa de metodología
   - **Then** la propuesta es Kanban y la justificación explica cómo se adapta a este equipo

---

### User Story 3 - Plan realista para el equipo (Priority: P2)

El backlog y los sprints tienen en cuenta quién forma el equipo: cada historia queda asignada a un miembro con un rol adecuado, y ninguna iteración tiene más trabajo del que el equipo puede hacer con sus horas disponibles.

**Why this priority**: un plan que no se puede cumplir le quita credibilidad al producto, pero la demo funciona aunque la estimación no sea perfecta.

**Independent Test**: con un equipo de 3 personas a 10 horas por semana, verificar que ninguna iteración supera la capacidad estimada y que todas las historias tienen un responsable del equipo.

**Acceptance Scenarios**:

1. **Scenario**: Asignación por rol
   - **Given** un equipo con un desarrollador frontend y uno backend
   - **When** termina la etapa de sprints
   - **Then** cada historia está asignada por nombre a un miembro real del equipo cuyo rol encaja con la historia

2. **Scenario**: Historias sin huecos
   - **Given** un backlog aprobado con 20 historias
   - **When** termina la etapa de sprints
   - **Then** cada historia está en exactamente una iteración y ninguna queda afuera

---

### User Story 4 - Rehacer una etapa rechazada (Priority: P2)

Si el líder rechaza una propuesta y da un motivo ("es demasiado ambicioso para 4 semanas"), el agente vuelve a hacer esa etapa teniendo en cuenta el motivo.

**Why this priority**: completa el ciclo de aprobación, pero la demo puede hacerse solo aprobando.

**Independent Test**: rechazar la propuesta de roadmap con un motivo y verificar que la nueva propuesta lo tiene en cuenta y que la anterior queda en el historial como rechazada.

**Acceptance Scenarios**:

1. **Scenario**: Rechazo con motivo
   - **Given** una propuesta de roadmap pendiente
   - **When** el líder la rechaza con el motivo "son 4 semanas, no 8"
   - **Then** se genera una nueva propuesta de roadmap que entra en 4 semanas, y la anterior queda registrada como rechazada con su motivo

---

### User Story 5 - Recuperarse de un error del agente (Priority: P3)

Si un agente falla (el servicio no responde o devuelve algo inválido), el líder ve en qué etapa falló y puede reintentar desde esa etapa sin perder lo ya aprobado.

**Why this priority**: evita que un error a mitad de la demo obligue a empezar de cero.

**Independent Test**: simular un fallo en la etapa de backlog, reintentar y verificar que análisis, metodología, arquitectura y roadmap no se vuelven a generar.

**Acceptance Scenarios**:

1. **Scenario**: Fallo y reintento
   - **Given** la etapa de backlog falló
   - **When** el líder reintenta
   - **Then** corre de nuevo solo la etapa de backlog con el mismo contexto aprobado

---

### Edge Cases

- ¿Qué pasa si la descripción del proyecto es muy vaga ("una app")? El analista igual propone, y lista en riesgos y en el alcance lo que hace falta definir.
- ¿Qué pasa si el agente asigna una historia a alguien que no está en el equipo? La asignación se descarta y la historia se asigna a otro miembro con el mismo rol (regla de la spec 003).
- ¿Qué pasa si ningún miembro tiene el rol que pide una historia? La historia queda sin asignar y el análisis lo muestra como hueco del equipo.
- ¿Qué pasa si la duración no alcanza para el alcance? El roadmap ajusta el alcance al plazo y deja lo que no entra en "fuera de alcance", sin estirar el plazo.
- ¿Qué pasa si se inicia la planificación de un proyecto que ya está planificando? Se rechaza: hay una sola ejecución activa por proyecto.
- ¿Qué pasa si el agente devuelve algo con el formato incorrecto? Se reintenta una vez; si vuelve a fallar, la etapa queda en error (User Story 5).
- ¿Qué pasa si el líder cambia el equipo mientras se planifica? Las etapas ya aprobadas no cambian; el cambio se toma en cuenta en las etapas siguientes y luego se puede re-planificar (spec 008).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE correr las seis etapas en orden fijo: análisis, metodología, arquitectura, roadmap, backlog y sprints.
- **FR-002**: Cada etapa DEBE recibir los datos del proyecto y del equipo y la versión final (aprobada o ajustada) de las etapas anteriores que necesita. Nunca recibe propuestas pendientes ni rechazadas.
- **FR-003**: Cada etapa DEBE producir un resultado con una estructura fija y validada. No se aceptan resultados que no se puedan mostrar en pantalla (constitución, principio 2).
- **FR-004**: Cada resultado DEBE convertirse en una propuesta con su justificación visible para el líder.
- **FR-005**: La etapa siguiente DEBE arrancar solo cuando la anterior está aprobada o ajustada.
- **FR-006**: Con auto-aprobar activado, cada propuesta DEBE aprobarse sola y quedar registrada como aprobada automáticamente.
- **FR-007**: El sistema DEBE avisar en vivo cuándo empieza, termina o falla cada etapa y qué agente la corre (lo muestra la spec 005).
- **FR-008**: Si el líder eligió una metodología, la etapa de metodología DEBE respetarla. Si no, DEBE recomendar una y justificar al menos dos alternativas descartadas.
- **FR-009**: Cada historia del backlog DEBE pertenecer a una épica del roadmap aprobado y estar en exactamente una iteración.
- **FR-010**: Las asignaciones DEBEN referirse a miembros reales del equipo; el trabajo de cada iteración NO DEBE superar la capacidad estimada del equipo según sus horas y seniority.
- **FR-011**: Al rechazar una propuesta con motivo, el sistema DEBE rehacer esa etapa usando el motivo como contexto. [NEEDS CLARIFICATION: ¿se rehace automáticamente al rechazar, o el líder decide cuándo? Pregunta abierta 2 de use-cases.md, a acordar con la spec 005. Recomendación: automático, porque es más fluido para la demo.]
- **FR-012**: Si una etapa falla, el proyecto DEBE quedar en error indicando la etapa, y el líder DEBE poder reintentarla sin rehacer las etapas aprobadas.
- **FR-013**: Solo PUEDE haber una planificación activa por proyecto.
- **FR-014**: Los resultados DEBEN estar en el idioma de la descripción del proyecto.
- **FR-015**: El pipeline DEBE poder correr sin conexión al servicio de IA, con un plan de ejemplo, para desarrollar y hacer demos (constitución, principio 6).

### Key Entities

- **Etapa**: un paso del plan. Tiene nombre, el agente (rol) que la corre, qué etapas anteriores usa como entrada y la estructura de su resultado.
- **Propuesta de etapa**: el resultado de una etapa esperando decisión. Tiene contenido, justificación, estado (pendiente, aprobada, ajustada, rechazada), motivo de rechazo y si fue auto-aprobada. Su ciclo de vida lo define la spec 005.
- **Plan**: la versión final de todas las etapas aprobadas de un proyecto. Es lo que leen el tablero (003), las vistas (004) y los documentos (006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con auto-aprobar, el plan completo (las seis etapas) se genera en menos de 3 minutos para un proyecto de 3 a 5 personas.
- **SC-002**: El líder ve qué agente está trabajando en menos de 2 segundos desde que empieza cada etapa.
- **SC-003**: El 100% de las historias del plan final está en una iteración y pertenece a una épica existente.
- **SC-004**: Ninguna iteración supera la capacidad estimada del equipo.
- **SC-005**: Tras un fallo, el reintento no vuelve a generar ninguna etapa ya aprobada.
- **SC-006**: Sin conexión al servicio de IA, la demo completa (proyecto, plan y tablero) funciona de punta a punta.
