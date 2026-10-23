# Feature Specification: 006 · Specs y diagramas generados

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: Mitchz01  
**Reviewer**: sandredev  
**Use cases**: UC-08 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spec general del producto (Priority: P1)

Cuando se aprueba la última etapa del plan (sprints), un agente redactor arma la **spec general del producto**: problema, usuarios, objetivos, alcance, historias principales y criterios de éxito. Lo hace a partir del plan aprobado y la propone al líder como cualquier otra decisión de los agentes.

**Why this priority**: es el documento que más valor le da al equipo para arrancar, y hace que el producto aplique la misma práctica (specs antes de código) que recomienda.

**Independent Test**: aprobar un plan completo y verificar que aparece una propuesta de spec general que se puede leer, aprobar y luego consultar como documento del proyecto.

**Acceptance Scenarios**:

1. **Scenario**: Generación al cerrar el plan
   - **Given** un proyecto al que solo le falta aprobar la etapa de sprints
   - **When** el líder la aprueba
   - **Then** se avisa que el redactor está trabajando y aparece una propuesta de spec general

2. **Scenario**: Aprobación crea el documento
   - **Given** una propuesta de spec general pendiente
   - **When** el líder la aprueba
   - **Then** queda un documento "Spec general" en versión 1, visible en el proyecto

---

### User Story 2 - Specs por épica (Priority: P2)

Además de la general, el redactor arma una spec por cada épica del roadmap. Cada una describe sus historias con criterios de aceptación, casos borde y requisitos, para que quien tome esas tareas tenga el detalle.

**Why this priority**: es lo que usa el equipo día a día, pero la general ya alcanza para mostrar la funcionalidad.

**Independent Test**: con un roadmap de 5 épicas, verificar que se proponen 5 specs y que cada una nombra las historias de su épica.

**Acceptance Scenarios**:

1. **Scenario**: Una spec por épica
   - **Given** un plan aprobado con 5 épicas
   - **When** termina la generación de specs
   - **Then** hay 5 propuestas de spec, una por épica, cada una con las historias y los criterios de aceptación de esa épica

---

### User Story 3 - Diagramas de flujo (Priority: P2)

El redactor arma diagramas de flujo de los recorridos principales del producto (por ejemplo, alta de usuario o checkout) y un diagrama de la arquitectura aprobada. Los diagramas se ven dibujados dentro de la herramienta y también se pueden copiar a GitHub, donde se ven igual.

**Why this priority**: tiene mucho impacto visual en la demo, aunque no es imprescindible para trabajar.

**Independent Test**: aprobar el plan, abrir los diagramas propuestos y verificar que todos se dibujan sin errores.

**Acceptance Scenarios**:

1. **Scenario**: Diagramas válidos
   - **Given** un plan aprobado
   - **When** termina la generación de diagramas
   - **Then** hay al menos un diagrama de arquitectura y uno de flujo por recorrido principal, y todos se dibujan correctamente

---

### User Story 4 - Regenerar un documento (Priority: P3)

El líder puede pedir que se regenere un documento con indicaciones ("agregá el flujo de pagos", "más corto"). El resultado llega como una nueva propuesta y, al aprobarse, queda como nueva versión sin perder la anterior.

**Why this priority**: mejora la calidad de los documentos con el tiempo, pero no hace falta para la demo.

**Independent Test**: regenerar la spec general con una indicación, aprobarla y verificar que hay una versión 2 y que la versión 1 sigue disponible.

**Acceptance Scenarios**:

1. **Scenario**: Nueva versión
   - **Given** la spec general en versión 1
   - **When** el líder pide regenerarla con "agregá el flujo de pagos" y aprueba la propuesta
   - **Then** la spec general pasa a versión 2 con el flujo de pagos y la versión 1 sigue consultable

---

### Edge Cases

- ¿Qué pasa si un diagrama generado no se puede dibujar? Se reintenta la generación una vez; si sigue fallando, no se propone ese diagrama y se avisa cuál faltó.
- ¿Qué pasa si el roadmap tiene muchas épicas (más de 10)? Se generan igual, una propuesta por épica, y el líder las puede aprobar todas juntas.
- ¿Qué pasa si se rechaza una spec? Se aplica la misma regla de rechazo que en la spec 002 (FR-011).
- ¿Qué pasa si el plan cambia después de aprobar los documentos (re-planificación, spec 008)? Los documentos afectados quedan marcados como desactualizados y se ofrece regenerarlos; no se reescriben solos.
- ¿Qué pasa si el líder edita un documento a mano? La edición se guarda como nueva versión, igual que una regeneración.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al aprobarse la etapa de sprints, el sistema DEBE generar la spec general, las specs por épica y los diagramas, en ese orden.
- **FR-002**: Cada documento generado DEBE llegar como propuesta y no existir como documento del proyecto hasta que se apruebe (constitución, principio 8). Con auto-aprobar, se aprueba solo.
- **FR-003**: Los documentos DEBEN armarse solo con la versión final del plan aprobado y los datos del proyecto.
- **FR-004**: La spec general y las specs por épica DEBEN seguir la misma estructura que las specs de este repo: historias priorizadas con escenarios Dado/Cuando/Entonces, casos borde, requisitos y criterios de éxito.
- **FR-005**: El sistema DEBE generar una spec por cada épica del roadmap aprobado. [NEEDS CLARIFICATION: use-cases.md dice "por caso de uso o épica". Recomendación: por épica, porque las épicas son lo que el plan ya tiene. Los casos de uso podrían ser una etapa aparte más adelante.]
- **FR-006**: Cada diagrama DEBE comprobarse antes de proponerlo; no se propone un diagrama que no se pueda dibujar.
- **FR-007**: Los documentos DEBEN estar en un formato de texto que se vea igual en la herramienta y en GitHub.
- **FR-008**: Al aprobar el regenerado de un documento existente, el sistema DEBE crear una nueva versión y conservar las anteriores.
- **FR-009**: El líder DEBE poder pedir regenerar un documento con indicaciones en texto libre.
- **FR-010**: El sistema DEBE avisar en vivo qué documento se está generando (como en la spec 002, FR-007).
- **FR-011**: Si el plan cambia después de aprobar un documento, el sistema DEBE marcar ese documento como desactualizado.

### Key Entities

- **Documento**: spec general, spec de épica o diagrama de flujo de un proyecto. Tiene tipo, título, contenido, versión y si está desactualizado.
- **Versión de documento**: cada contenido aprobado de un documento; no se borra.
- **Propuesta de documento**: un documento (nuevo o una nueva versión) esperando aprobación. Su ciclo de vida lo define la spec 005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los documentos de un plan de 5 épicas se proponen en menos de 2 minutos desde que se aprueban los sprints.
- **SC-002**: El 100% de las épicas del roadmap tiene su spec propuesta.
- **SC-003**: El 100% de los diagramas propuestos se dibuja sin errores en la herramienta y en GitHub.
- **SC-004**: Regenerar un documento nunca borra una versión anterior.
- **SC-005**: Un miembro que recién llega al equipo encuentra en la spec de su épica los criterios de aceptación de todas sus tareas, sin preguntar a nadie.
