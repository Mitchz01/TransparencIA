# Feature Specification: 003 · Tablero kanban y sprints

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: codigotpx  
**Reviewer**: Mitchz01  
**Use cases**: UC-05, UC-06 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

Cuando el líder aprueba el plan, el trabajo aparece en un tablero listo para usar: sprints, tarjetas con prioridad, puntos, responsable y checklist. Desde ahí el equipo mueve las tarjetas, las edita y va tildando los pasos.

Columnas del tablero, en orden: **Backlog**, **Por hacer**, **En progreso**, **En revisión**, **Hecho**.

### User Story 1 - El plan aprobado se convierte en tablero (Priority: P1)

Cuando se aprueba la última etapa del plan (los sprints), el líder ve el tablero armado sin cargar nada a mano. Cada historia del backlog es una tarjeta dentro de su sprint, con su prioridad, puntos, criterios de aceptación, un checklist y el miembro asignado.

**Why this priority**: Es el final de la demo (proyecto → plan → aprobación → tablero, constitución principio 1). Sin esto, el plan queda en texto y no se puede trabajar.

**Independent Test**: Con un plan aprobado del modo de ejemplo (sin API key), abrir el tablero y verificar que cada historia aparece una sola vez, en su sprint y con todos sus datos.

**Acceptance Scenarios**:

1. **Scenario**: Plan aprobado manualmente
   - **Given** un proyecto con las etapas del plan aprobadas hasta el backlog
   - **When** el líder aprueba la etapa de sprints
   - **Then** el tablero muestra un sprint por cada iteración del plan, cada historia como tarjeta en "Por hacer" dentro de su sprint, y el proyecto pasa a "listo"

2. **Scenario**: Plan con auto-aprobar
   - **Given** un proyecto con auto-aprobar activo
   - **When** el agente termina la etapa de sprints
   - **Then** el tablero se arma solo, igual que en el escenario anterior

3. **Scenario**: Asignación por nombre
   - **Given** el agente asignó una historia a "Ana" y en el equipo hay una miembro llamada "Ana"
   - **When** se arma el tablero
   - **Then** la tarjeta queda asignada a Ana

4. **Scenario**: Asignación por rol cuando el nombre no coincide
   - **Given** el agente asignó una historia a un nombre que no está en el equipo, y la historia pide el rol "Backend"
   - **When** se arma el tablero
   - **Then** la tarjeta queda asignada al miembro con rol "Backend" que tenga menos puntos asignados en ese sprint

5. **Scenario**: Nadie cubre el rol
   - **Given** una historia pide el rol "Diseño UX" y nadie del equipo lo tiene
   - **When** se arma el tablero
   - **Then** la tarjeta queda sin asignar y marcada como "falta rol: Diseño UX"

6. **Scenario**: Checklist inicial
   - **Given** una historia con tres criterios de aceptación
   - **When** se arma el tablero
   - **Then** la tarjeta tiene un checklist de tres ítems sin tildar, uno por criterio

---

### User Story 2 - Mover tarjetas entre columnas (Priority: P1)

Un miembro arrastra una tarjeta de una columna a otra (por ejemplo, de "Por hacer" a "En progreso") o la reordena dentro de la columna. El cambio queda guardado.

**Why this priority**: Es la interacción básica de un tablero; sin ella, el tablero es solo una lista.

**Independent Test**: Con un tablero armado, arrastrar una tarjeta a otra columna, recargar la página y verificar que sigue ahí.

**Acceptance Scenarios**:

1. **Scenario**: Cambiar de columna
   - **Given** una tarjeta en "Por hacer"
   - **When** un miembro la arrastra a "En progreso"
   - **Then** la tarjeta queda en "En progreso" y sigue ahí después de recargar

2. **Scenario**: Reordenar dentro de la columna
   - **Given** tres tarjetas en "Por hacer"
   - **When** un miembro arrastra la tercera al primer lugar
   - **Then** el nuevo orden se mantiene después de recargar

3. **Scenario**: Superar el límite WIP
   - **Given** la metodología fija un límite de 3 tarjetas en "En progreso" y ya hay 3
   - **When** un miembro mueve una cuarta tarjeta a "En progreso"
   - **Then** la tarjeta se mueve igual y la columna muestra un aviso de límite superado (no se bloquea: "El usuario manda")

4. **Scenario**: Falla al guardar
   - **Given** se pierde la conexión con el servidor
   - **When** un miembro mueve una tarjeta
   - **Then** la tarjeta vuelve a su lugar original y se muestra un mensaje de que no se pudo guardar

---

### User Story 3 - Editar una tarea y su checklist (Priority: P2)

Un miembro abre una tarjeta, corrige lo que generaron los agentes (título, descripción, puntos, prioridad, responsable) y va tildando los pasos del checklist. También puede agregar, editar o quitar pasos.

**Why this priority**: Todo lo generado tiene que ser editable (constitución principio 4), y el checklist es parte central del producto. Pero se puede demostrar el tablero sin editar.

**Independent Test**: Abrir una tarjeta, cambiar su prioridad, tildar un ítem del checklist y agregar uno nuevo; recargar y verificar los cambios.

**Acceptance Scenarios**:

1. **Scenario**: Editar datos de la tarea
   - **Given** una tarjeta con prioridad "media"
   - **When** un miembro la cambia a "alta" y guarda
   - **Then** la tarjeta muestra prioridad "alta"

2. **Scenario**: Tildar un paso
   - **Given** una tarjeta con un checklist de 4 ítems sin tildar
   - **When** un miembro tilda uno
   - **Then** la tarjeta muestra el progreso "1/4" en el tablero

3. **Scenario**: Agregar y quitar pasos
   - **Given** una tarjeta con checklist
   - **When** un miembro agrega un ítem y quita otro
   - **Then** el checklist refleja los cambios y el progreso se recalcula

4. **Scenario**: Checklist completo
   - **Given** una tarjeta en "En progreso" con todos los ítems menos uno tildados
   - **When** un miembro tilda el último
   - **Then** la tarjeta sugiere moverla a "En revisión", pero no se mueve sola

5. **Scenario**: Reasignar
   - **Given** una tarjeta sin asignar por falta de rol
   - **When** el líder la asigna a un miembro
   - **Then** desaparece la marca "falta rol" y la tarjeta muestra al nuevo responsable

---

### User Story 4 - Navegar y reorganizar los sprints (Priority: P2)

El tablero muestra un sprint a la vez, con un selector para cambiar de sprint o ver el backlog. El líder puede mover una tarjeta de un sprint a otro o devolverla al backlog, y ve cuántos puntos tiene cada sprint frente a la capacidad del equipo.

**Why this priority**: Un plan real tiene varios sprints; sin esto solo se ve un montón de tarjetas mezcladas. Sigue siendo útil sin reorganizar.

**Independent Test**: Con un plan de 3 sprints, cambiar de sprint con el selector, mover una tarjeta del sprint 1 al 2 y verificar que los totales de puntos de ambos se actualizan.

**Acceptance Scenarios**:

1. **Scenario**: Sprint por defecto
   - **Given** un tablero con 3 sprints y el primero con tareas pendientes
   - **When** un miembro abre el tablero
   - **Then** ve el primer sprint que tiene tareas sin terminar

2. **Scenario**: Mover entre sprints
   - **Given** una tarjeta de 5 puntos en el sprint 1
   - **When** el líder la mueve al sprint 2
   - **Then** el sprint 1 baja 5 puntos, el sprint 2 sube 5, y la tarjeta queda en "Por hacer" del sprint 2

3. **Scenario**: Sprint sobrecargado
   - **Given** un sprint cuyos puntos superan la capacidad estimada del equipo
   - **When** el líder ve ese sprint
   - **Then** se muestra un aviso de sobrecarga, sin bloquear

---

### User Story 5 - Filtrar el tablero (Priority: P3)

Un miembro filtra el tablero para ver solo sus tarjetas, o por prioridad o épica.

**Why this priority**: Mejora el uso diario, pero no es necesario para la demo.

**Independent Test**: Activar el filtro "Mis tareas" y verificar que solo quedan las tarjetas asignadas a ese miembro.

**Acceptance Scenarios**:

1. **Scenario**: Mis tareas
   - **Given** un sprint con tarjetas de varios miembros
   - **When** un miembro filtra por su nombre
   - **Then** solo ve sus tarjetas, y el filtro se mantiene al cambiar de sprint

---

### Edge Cases

- ¿Qué pasa si una historia del backlog no quedó en ningún sprint? Va a la columna "Backlog", fuera de los sprints.
- ¿Qué pasa si el plan referencia una historia que no existe en el backlog? Se ignora y se avisa al líder; no se crea una tarjeta vacía.
- ¿Qué pasa si hay dos miembros con el mismo nombre? Se asigna por rol, como si el nombre no coincidiera.
- ¿Qué pasa si se intenta armar el tablero dos veces para el mismo plan? No se duplican tarjetas; volver a planificar es re-planificación (spec 008).
- ¿Qué pasa si se quita del equipo a un miembro con tareas? Sus tarjetas quedan sin asignar y marcadas para reasignar, y el sistema propone re-planificar (spec 008, FR-010).
- ¿Qué pasa si dos personas mueven la misma tarjeta a la vez? Queda el último cambio, y ambos lo ven (actividad en vivo, spec 005).
- ¿Qué pasa si una tarea vinculada a una issue de GitHub se mueve a mano? Se respeta: el tablero es la fuente de verdad. Un evento posterior de GitHub puede volver a moverla, pero nunca la saca de "Hecho" salvo que se reabra la issue (spec 008, FR-004).
- ¿Qué pasa con una historia sin criterios de aceptación? La tarjeta queda con el checklist vacío.
- ¿Qué pasa si la metodología elegida es Kanban (sin iteraciones)? El tablero es continuo: todas las tareas en una sola vista, sin selector de sprint ni aviso de capacidad por sprint. Las iteraciones que arma el agente se guardan igual, con su objetivo y sus tareas, pero el tablero no las separa: se muestran como **objetivos** que se pueden usar como filtro y que se cumplen igual que en Scrum (FR-002).

## Requirements *(mandatory)*

### Functional Requirements

**Armado del tablero (UC-05)**

- **FR-001**: El sistema MUST crear el tablero automáticamente cuando se aprueba la etapa de sprints del plan, manual o por auto-aprobar.
- **FR-002**: El sistema MUST crear un sprint por cada iteración del plan, con su número, nombre y fase del roadmap, y un **objetivo** formado por la meta de la iteración y sus tareas. El objetivo se cumple cuando todas sus tareas están hechas (lo cierra la spec 008).
- **FR-003**: El sistema MUST crear una tarea por cada historia del backlog aprobado, sin duplicados ni pérdidas, en el sprint que le asignó el plan.
- **FR-004**: Cada tarea MUST conservar de la historia: clave (US-n), épica, título, descripción, criterios de aceptación, tipo, puntos y prioridad.
- **FR-005**: El sistema MUST generar el checklist inicial de cada tarea con un ítem por criterio de aceptación.
- **FR-006**: El sistema MUST asignar cada tarea al miembro que nombró el agente; si el nombre no coincide, al miembro con el rol pedido y menos puntos en ese sprint; si nadie tiene el rol, la deja sin asignar y marcada con el rol faltante.
- **FR-007**: Las tareas que el plan no ubicó en ningún sprint MUST quedar en "Backlog".
- **FR-008**: Al terminar el armado, el proyecto MUST pasar a estado "listo" y el tablero MUST quedar disponible para todo el equipo.

**Trabajo en el tablero (UC-06)**

- **FR-009**: Los usuarios MUST poder mover una tarjeta entre las columnas Backlog, Por hacer, En progreso, En revisión y Hecho, y reordenarla dentro de una columna.
- **FR-010**: El sistema MUST guardar cada movimiento y mostrarlo igual después de recargar o desde otro dispositivo.
- **FR-011**: Si un movimiento no se puede guardar, la tarjeta MUST volver a su lugar y el usuario MUST ver un aviso.
- **FR-012**: El sistema MUST avisar, sin bloquear, cuando una columna supera el límite WIP definido por la metodología aprobada.
- **FR-013**: Los usuarios MUST poder editar título, descripción, puntos, prioridad y responsable de una tarea.
- **FR-014**: Los usuarios MUST poder tildar, destildar, agregar, editar y quitar ítems del checklist; la tarjeta MUST mostrar el progreso (tildados sobre total).
- **FR-015**: Cuando se completa el checklist, el sistema MUST sugerir avanzar la tarjeta, sin moverla solo.
- **FR-016**: Los usuarios MUST poder cambiar de sprint con un selector, ver el backlog y mover tarjetas entre sprints o al backlog. Si la metodología es Kanban, el tablero MUST ser continuo y las iteraciones se muestran como objetivos (ver casos borde).
- **FR-017**: El sistema MUST mostrar los puntos totales de cada sprint frente a la capacidad del equipo y avisar si hay sobrecarga. La capacidad se estima sola a partir de las horas por semana de cada miembro, su seniority y la duración del sprint, con la misma regla que usan los agentes para armar los sprints (spec 002, FR-010), para que un plan recién generado nunca aparezca sobrecargado; el líder MUST poder reemplazarla por un valor fijo de puntos por sprint (por ejemplo, cuando ya conoce la velocidad real del equipo).
- **FR-018**: Los usuarios MUST poder filtrar el tablero por responsable, prioridad y épica.
- **FR-019**: Cada cambio en el tablero MUST publicarse como actividad del proyecto para que los demás lo vean en vivo (spec 005).

### Key Entities *(include if feature involves data)*

- **Sprint**: iteración del proyecto. Número, nombre, objetivo y fase del roadmap a la que pertenece. Agrupa tareas.
- **Objetivo**: la meta de un sprint junto con sus tareas. Se cumple cuando todas están hechas; lo cierra la spec 008. Con Kanban, es lo único que queda visible de cada iteración.
- **Tarea (tarjeta)**: unidad de trabajo que sale de una historia. Clave, épica, título, descripción, criterios de aceptación, tipo, puntos, prioridad, columna, posición dentro de la columna, sprint (o backlog) y responsable (o rol faltante).
- **Ítem de checklist**: paso concreto de una tarea. Texto y si está hecho.
- **Límite WIP**: máximo de tarjetas por columna según la metodología aprobada. Solo genera avisos.
- **Miembro**: viene de la spec 001. Se usa su nombre, rol y horas para asignar y calcular capacidad.

### Dependencies

- **005 → 003**: el armado del tablero arranca cuando se aprueba la etapa de sprints. Hay que acordar con sandredev qué datos trae la aprobación (contrato `PlanApplied` en [specs/README.md](../README.md)).
- **002**: la forma del backlog y de los sprints que generan los agentes, y la regla de capacidad, que tiene que ser la misma en las dos specs.
- **008**: cierra los objetivos y propone re-planificar cuando cambia el equipo o un sprint termina con pendientes.
- **005**: los eventos del tablero que se muestran en la actividad en vivo (contrato 003, 005).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El tablero aparece en menos de 5 segundos después de aprobar la etapa de sprints.
- **SC-002**: El 100% de las historias aprobadas aparece como tarjeta exactamente una vez.
- **SC-003**: Cuando el equipo cubre todos los roles que pide el plan, al menos el 90% de las tarjetas queda asignada sin intervención del líder.
- **SC-004**: Mover una tarjeta se ve reflejado al instante para quien la mueve, y el 100% de los movimientos guardados sigue igual después de recargar.
- **SC-005**: En la demo, un miembro que nunca usó la herramienta logra mover una tarjeta y tildar un paso del checklist en su primer intento, sin ayuda.
