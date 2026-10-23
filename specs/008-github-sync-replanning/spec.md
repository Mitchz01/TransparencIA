# Feature Specification: 008 · Sincronización desde GitHub y re-planificación

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: Mitchz01  
**Reviewer**: sandredev  
**Use cases**: UC-12, UC-13 ([plan/use-cases.md](../../plan/use-cases.md))  

Depende de la spec 007, que conecta el repo y vincula cada tarea con su issue. El contrato 007 → 008 (qué eventos de GitHub llegan y cómo identifican la tarea) se acuerda con codigotpx antes de aprobar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El tablero avanza solo con GitHub (Priority: P1)

A medida que el equipo trabaja en GitHub, las tareas se mueven solas en el tablero. Como **nuestro tablero es la fuente de verdad**, desde GitHub solo llega el avance, y se aplica sin pedir aprobación:

| Qué pasa en GitHub | Efecto en la tarea |
|---|---|
| Se abre un PR que cierra la issue | En curso |
| El PR queda listo para revisión | En revisión |
| Se mergea el PR | Hecha, con el checklist completo |
| Se cierra la issue sin PR | Hecha |
| Se reabre la issue | Por hacer |

**Why this priority**: es lo que hace que el plan "se mantenga vivo" sin trabajo manual, y se ve muy bien en la demo.

**Independent Test**: con un repo conectado y tareas publicadas como issues, abrir y mergear un PR que cierre una issue, y verificar que la tarea pasa por "en curso" y "hecha" sin tocar el tablero.

**Acceptance Scenarios**:

1. **Scenario**: PR mergeado
   - **Given** una tarea "en revisión" vinculada a la issue #12
   - **When** se mergea un PR que cierra la #12
   - **Then** la tarea pasa a "hecha", su checklist queda completo y el cambio se ve en vivo en el tablero

2. **Scenario**: PR que cierra varias issues
   - **Given** dos tareas vinculadas a las issues #12 y #13
   - **When** se abre un PR que cierra ambas
   - **Then** las dos tareas pasan a "en curso"

3. **Scenario**: Aviso que no viene de GitHub
   - **Given** un aviso de cambio que no viene de GitHub (no tiene la firma del proyecto)
   - **When** llega al sistema
   - **Then** se rechaza y el tablero no cambia

---

### User Story 2 - Re-planificar a pedido (Priority: P1)

El líder pide re-planificar con un motivo ("se fue un dev", "entró un cliente nuevo", "vamos atrasados"). Los agentes miran el plan, el equipo actual, el tablero y el avance real, y proponen **cambios concretos**: tareas que se mueven de sprint, reasignaciones, tareas nuevas y tareas descartadas, cada cambio con su justificación. El líder lo aprueba, lo ajusta o lo rechaza como cualquier propuesta. Las tareas hechas no se tocan nunca.

**Why this priority**: es el extra de la demo que muestra que los agentes no solo arman el plan, también lo mantienen.

**Independent Test**: con un plan aplicado, quitar a un miembro del equipo, pedir re-planificar y verificar que la propuesta reasigna sus tareas pendientes y que, al aprobarla, el tablero cambia en un solo paso.

**Acceptance Scenarios**:

1. **Scenario**: Se va un miembro
   - **Given** un plan aplicado en el que Ana tiene 4 tareas pendientes y 2 hechas
   - **When** el líder saca a Ana del equipo y pide re-planificar con "se fue Ana"
   - **Then** la propuesta reasigna las 4 tareas pendientes a miembros con un rol adecuado, mueve de sprint lo que no entra por capacidad y no toca las 2 tareas hechas

2. **Scenario**: Aprobar aplica todo junto
   - **Given** una propuesta de re-planificación con 6 cambios
   - **When** el líder la aprueba
   - **Then** se aplican los 6 cambios juntos; si alguno no se puede aplicar, no se aplica ninguno

3. **Scenario**: Ajustar antes de aprobar
   - **Given** una propuesta de re-planificación
   - **When** el líder quita uno de los cambios y aprueba
   - **Then** se aplican todos los cambios menos ese

---

### User Story 3 - Objetivos que se cierran solos (Priority: P2)

Cada fase o sprint tiene objetivos. Cuando todas las tareas de un objetivo están hechas, el objetivo se marca como cumplido sin que nadie lo cierre a mano.

**Why this priority**: da sensación de avance, pero el tablero ya muestra el progreso tarea por tarea.

**Independent Test**: completar la última tarea pendiente de un objetivo, desde GitHub o moviéndola a mano, y verificar que el objetivo queda cumplido.

**Acceptance Scenarios**:

1. **Scenario**: Última tarea hecha
   - **Given** un objetivo con 3 tareas, 2 hechas
   - **When** la tercera pasa a "hecha"
   - **Then** el objetivo queda cumplido y se avisa en la actividad en vivo

---

### User Story 4 - Detectar desvíos (Priority: P3)

El sistema detecta cuándo el plan se desvió de la realidad (un sprint terminó con tareas pendientes, o cambió el equipo con un plan ya aplicado) y lo señala para re-planificar.

**Why this priority**: es automatización sobre la User Story 2, que ya cubre el caso a pedido.

**Independent Test**: cerrar un sprint con 3 tareas sin terminar y verificar que el sistema reacciona como define FR-010.

**Acceptance Scenarios**:

1. **Scenario**: Sprint con pendientes
   - **Given** un sprint que llegó a su fecha de fin con 3 tareas sin terminar
   - **When** se cierra el sprint
   - **Then** el sistema reacciona según FR-010, indicando las 3 tareas pendientes como motivo

---

### Edge Cases

- ¿Qué pasa si GitHub manda el mismo aviso dos veces? El efecto se aplica una sola vez.
- ¿Qué pasa si llega un aviso de un repo que no está conectado a ningún proyecto, o de una issue sin tarea vinculada? Se ignora sin error.
- ¿Qué pasa si una tarea ya está "hecha" (movida a mano) y llega un aviso de PR abierto? No retrocede: los avisos de GitHub nunca sacan una tarea de "hecha", salvo que se reabra la issue.
- ¿Qué pasa si se pide re-planificar con otra re-planificación pendiente? La nueva reemplaza a la anterior, que queda descartada en el historial.
- ¿Qué pasa si el tablero cambió entre que se generó la propuesta y se aprobó? Los cambios que se refieren a tareas que ya no están en el estado esperado se descartan, y el resto se aplica; el líder ve cuáles se descartaron.
- ¿Qué pasa si la re-planificación agrega tareas y el proyecto tiene repo conectado? Las tareas nuevas siguen el flujo de publicación de issues de la spec 007.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE recibir los avisos de PRs e issues del repo conectado y aplicar los cambios de estado de la tabla de la User Story 1, sin propuesta.
- **FR-002**: El sistema DEBE verificar que cada aviso venga realmente de GitHub para ese proyecto, y rechazar los que no.
- **FR-003**: Procesar el mismo aviso más de una vez NO DEBE cambiar el resultado.
- **FR-004**: Los avisos de GitHub NO DEBEN sacar una tarea de "hecha", salvo la reapertura de la issue.
- **FR-005**: Al mergear un PR, las tareas vinculadas DEBEN quedar con el checklist completo.
- **FR-006**: Cada cambio que llega desde GitHub DEBE verse en vivo en el tablero y en la actividad del proyecto (spec 005).
- **FR-007**: Un objetivo DEBE marcarse como cumplido cuando todas sus tareas están hechas, sin importar si llegaron a "hecha" desde GitHub o a mano.
- **FR-008**: El líder DEBE poder pedir re-planificar con un motivo en texto libre.
- **FR-009**: La re-planificación DEBE llegar como una propuesta con una lista de cambios (mover de sprint, reasignar, agregar, descartar), cada uno con su justificación, basada en el plan aprobado, el equipo actual, el tablero y el avance real.
- **FR-010**: Cuando un sprint termina con pendientes o cambia el equipo con un plan aplicado, el sistema DEBE señalar el desvío. [NEEDS CLARIFICATION: ¿propone la re-planificación solo o solo avisa y el líder decide? Pregunta abierta 3 de use-cases.md. Recomendación: proponerla sola, porque igual pasa por la aprobación del líder (constitución, principio 8).]
- **FR-011**: Ninguna re-planificación DEBE modificar tareas hechas.
- **FR-012**: Al aprobar una re-planificación, sus cambios DEBEN aplicarse todos juntos o ninguno, salvo los descartados por el caso borde del tablero cambiado, que se informan.
- **FR-013**: El líder DEBE poder quitar cambios individuales de la propuesta antes de aprobarla.
- **FR-014**: Solo PUEDE haber una re-planificación pendiente por proyecto.

### Key Entities

- **Aviso de GitHub**: un cambio en un PR o una issue del repo conectado. Indica qué issues afecta y qué pasó.
- **Vínculo tarea ↔ issue**: relaciona cada tarea con su issue. Lo crea la spec 007; esta spec solo lo lee.
- **Objetivo**: meta de una fase o sprint con sus tareas; queda cumplido cuando todas están hechas.
- **Propuesta de re-planificación**: el motivo, la lista de cambios con su justificación y su estado. Su ciclo de vida lo define la spec 005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cambio en GitHub se ve en el tablero en menos de 10 segundos.
- **SC-002**: Repetir avisos de GitHub nunca genera cambios duplicados ni tareas en un estado incorrecto.
- **SC-003**: La propuesta de re-planificación llega en menos de 60 segundos desde que se pide.
- **SC-004**: El 0% de las tareas hechas cambia por una re-planificación.
- **SC-005**: Tras aprobar una re-planificación por la salida de un miembro, el 100% de sus tareas pendientes queda reasignado o descartado con justificación.
