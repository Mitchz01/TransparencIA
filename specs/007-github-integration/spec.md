# Feature Specification: 007 · Integración con GitHub

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: codigotpx  
**Reviewer**: Mitchz01  
**Use cases**: UC-09, UC-10, UC-11 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

El líder conecta el repositorio de GitHub del proyecto. A partir de ahí, las tareas del tablero se publican como issues y, cuando alguien abre un PR que resuelve una tarea, los agentes proponen quién lo revisa y dejan una primera revisión.

Reglas que vienen del contexto del producto:
- **Un solo repo por proyecto.**
- **Nuestro tablero es la fuente de verdad**: las issues son un espejo de las tareas.
- **Todo lo que se escribe en GitHub pasa por una propuesta**, porque lo ven terceros. Se aprueba a mano o con auto-aprobar (spec 005).

### User Story 1 - Conectar el repo del proyecto (Priority: P1)

El líder entra a Integraciones, escribe el repo (`owner/nombre`) y lo conecta. El sistema verifica que tiene acceso y muestra el repo conectado.

**Why this priority**: Sin repo conectado no funciona nada del resto de la integración.

**Independent Test**: Conectar un repo de prueba al que se tiene acceso y verificar que el proyecto lo muestra como conectado. Probar también con un repo inexistente.

**Acceptance Scenarios**:

1. **Scenario**: Conexión exitosa
   - **Given** un proyecto sin repo y un repo al que el sistema tiene acceso
   - **When** el líder ingresa `owner/nombre` y confirma
   - **Then** el proyecto muestra el repo como conectado, con un link a GitHub

2. **Scenario**: Repo inexistente o sin acceso
   - **Given** un repo que no existe o al que el sistema no tiene acceso
   - **When** el líder intenta conectarlo
   - **Then** se muestra un mensaje claro ("no existe" o "sin permisos") y el proyecto queda sin repo

3. **Scenario**: Cambiar de repo
   - **Given** un proyecto que ya tiene un repo conectado
   - **When** el líder conecta otro
   - **Then** se le avisa que reemplaza al anterior y, si confirma, queda conectado solo el nuevo

4. **Scenario**: Desconectar
   - **Given** un proyecto con repo conectado
   - **When** el líder lo desconecta
   - **Then** el proyecto deja de recibir y enviar cambios a GitHub; las tarjetas conservan los links a las issues ya creadas

---

### User Story 2 - Publicar las tareas como issues (Priority: P1)

Con el tablero armado y el repo conectado, el sistema propone publicar las tareas como issues. El líder ve la lista, la aprueba (o quita algunas) y se crean las issues. Cada tarjeta muestra el número y el link de su issue.

**Why this priority**: Es el puente entre el plan y el trabajo real del equipo en GitHub, y la base para sincronizar el avance (spec 008).

**Independent Test**: Con un tablero de 5 tareas y un repo de prueba, aprobar la propuesta y verificar que se crean 5 issues y que cada tarjeta muestra su link.

**Acceptance Scenarios**:

1. **Scenario**: Propuesta de publicación
   - **Given** un proyecto con tablero armado y repo conectado
   - **When** se conecta el repo o se arma el tablero (lo que pase último)
   - **Then** aparece una propuesta "Publicar N tareas como issues" con la lista de tareas

2. **Scenario**: Aprobar la publicación
   - **Given** la propuesta de publicación pendiente
   - **When** el líder la aprueba
   - **Then** se crea una issue por tarea, con título, descripción, criterios de aceptación, checklist como lista de tareas de GitHub, etiquetas de tipo y prioridad, y el responsable si tiene usuario de GitHub; cada tarjeta muestra "#número" con link

3. **Scenario**: Ajustar antes de aprobar
   - **Given** la propuesta de publicación pendiente
   - **When** el líder quita dos tareas de la lista y aprueba
   - **Then** solo se publican las tareas que quedaron; las otras pueden publicarse más adelante

4. **Scenario**: Tareas nuevas
   - **Given** tareas ya publicadas y una tarea nueva creada después
   - **When** el sistema arma la siguiente propuesta de publicación
   - **Then** la propuesta incluye solo las tareas sin issue; nunca se publica dos veces la misma tarea

5. **Scenario**: Falla parcial
   - **Given** GitHub rechaza la creación de algunas issues
   - **When** termina la publicación
   - **Then** las issues creadas quedan vinculadas y el líder ve cuáles fallaron y puede reintentarlas

---

### User Story 3 - Registrar el usuario de GitHub de cada miembro (Priority: P2)

El líder carga el usuario de GitHub de cada miembro del equipo. Así las issues se asignan a la persona correcta y se pueden sugerir revisores.

**Why this priority**: Sin esto las issues se publican igual, pero sin asignar y sin revisores sugeridos.

**Independent Test**: Cargar el usuario de GitHub de un miembro, publicar una tarea asignada a él y verificar que la issue queda asignada a ese usuario.

**Acceptance Scenarios**:

1. **Scenario**: Usuario válido
   - **Given** un miembro sin usuario de GitHub
   - **When** el líder carga un usuario que existe y tiene acceso al repo
   - **Then** el miembro queda vinculado y sus próximas issues se asignan a ese usuario

2. **Scenario**: Usuario sin acceso al repo
   - **Given** un usuario de GitHub que existe pero no tiene acceso al repo
   - **When** el líder lo carga
   - **Then** se guarda con un aviso de que no se le podrán asignar issues ni reviews hasta que tenga acceso

---

### User Story 4 - Code review asistido de un PR (Priority: P2)

Cuando alguien abre un PR que resuelve una tarea del proyecto, el sistema propone quién debería revisarlo y prepara una primera revisión hecha por un agente, que compara el cambio con los criterios de aceptación de la tarea. Si el líder lo aprueba, se piden las reviews y se publica el comentario en el PR.

**Why this priority**: Es la parte de "automatización con agentes" que más valor muestra, pero depende de que ya existan issues y usuarios de GitHub.

**Independent Test**: Abrir un PR en el repo de prueba que diga "Closes #N" para una issue del proyecto, y verificar que aparece la propuesta con revisores y comentario; aprobarla y ver el pedido de review y el comentario en GitHub.

**Acceptance Scenarios**:

1. **Scenario**: PR vinculado a una tarea
   - **Given** una tarea publicada como issue #12
   - **When** un miembro abre un PR que dice "Closes #12"
   - **Then** aparece una propuesta con revisores sugeridos y un comentario de revisión del agente, con su justificación

2. **Scenario**: Elección de revisores
   - **Given** un PR de un miembro Backend en un equipo con otros dos miembros Backend
   - **When** el sistema sugiere revisores
   - **Then** sugiere al miembro Backend con menos reviews pendientes, nunca al autor del PR

3. **Scenario**: Aprobar la revisión
   - **Given** la propuesta de revisión pendiente
   - **When** el líder la aprueba (o cambia los revisores y aprueba)
   - **Then** se pide review a los revisores elegidos y se publica el comentario en el PR, identificado como generado por un agente

4. **Scenario**: PR sin tarea
   - **Given** un PR que no referencia ninguna issue del proyecto
   - **When** se abre
   - **Then** el sistema no propone nada

---

### Edge Cases

- ¿Qué pasa si se cambia de repo con issues ya publicadas? Las tarjetas conservan los links al repo anterior; las tareas sin issue se publican en el nuevo.
- ¿Qué pasa si se edita una tarea ya publicada (título, descripción, criterios, checklist, responsable)? La issue se actualiza sola, sin propuesta: publicarla ya se aprobó, la issue es un espejo de la tarea, y el cambio lo hizo una persona, no un agente. Queda registrado en la actividad.
- ¿Qué pasa si alguien edita la issue directamente en GitHub? No se toca la tarea; desde GitHub solo entran cambios de estado (spec 008).
- ¿Qué pasa si la issue se borra en GitHub? La tarjeta muestra el link como roto y la tarea vuelve a poder publicarse.
- ¿Qué pasa si el autor del PR es el único miembro con ese rol? Se sugiere al líder como revisor.
- ¿Qué pasa si el PR es muy grande para revisar entero? El agente revisa lo que alcanza y lo dice explícitamente en el comentario.
- ¿Qué pasa si GitHub no responde o limita las llamadas? La acción queda pendiente y se reintenta; el líder ve que está demorada.
- ¿Qué pasa si se abren varios PRs para la misma tarea? Se propone revisión para cada uno.
- ¿El sistema también abre PRs? No. Los PRs los abre el equipo con su código; el sistema pide reviews y comenta. Crear ramas o PRs borrador por tarea queda fuera de alcance de esta spec (se puede sumar después sin cambiar lo demás).

## Requirements *(mandatory)*

### Functional Requirements

**Conexión (UC-09)**

- **FR-001**: El líder MUST poder conectar un único repo de GitHub por proyecto, indicando `owner/nombre`.
- **FR-002**: El sistema MUST verificar que el repo existe y que tiene permisos para crear issues y comentar antes de darlo por conectado, y mostrar el motivo si falla.
- **FR-003**: El sistema MUST quedar suscrito a los cambios del repo (PRs e issues) al conectarlo, y dejar de estarlo al desconectarlo o reemplazarlo.
- **FR-004**: El líder MUST poder cargar un token de GitHub para su proyecto al conectarlo (constitución, principio 5). Si no carga uno, el sistema usa el token de la instalación si existe (útil para la demo). El token nunca se vuelve a mostrar en la interfaz; solo se puede reemplazar o borrar.
- **FR-005**: Sin ningún token (ni del proyecto ni de la instalación), el sistema MUST funcionar en modo de prueba: registra las acciones en vez de enviarlas a GitHub, para poder hacer la demo (constitución, principio 6).

**Publicación de issues (UC-10)**

- **FR-006**: Con tablero y repo, el sistema MUST proponer la publicación de todas las tareas que todavía no tienen issue.
- **FR-007**: El líder MUST poder quitar tareas de la propuesta antes de aprobarla.
- **FR-008**: Al aprobarse, el sistema MUST crear una issue por tarea con título, descripción, criterios de aceptación, checklist como lista de tareas, etiquetas de tipo y prioridad, y el responsable si tiene usuario de GitHub.
- **FR-009**: Cada tarjeta publicada MUST mostrar el número y el link de su issue.
- **FR-010**: El sistema MUST garantizar que una tarea tenga como máximo una issue.
- **FR-011**: Ante fallas parciales, el sistema MUST conservar las issues creadas, mostrar cuáles fallaron y permitir reintentarlas.

**Usuarios de GitHub**

- **FR-012**: El líder MUST poder cargar y editar el usuario de GitHub de cada miembro, y el sistema MUST avisar si ese usuario no tiene acceso al repo.

**Code review asistido (UC-11)**

- **FR-013**: Cuando se abre un PR que referencia una issue del proyecto, el sistema MUST generar una propuesta de revisión con revisores sugeridos y un comentario del agente revisor.
- **FR-014**: El sistema MUST sugerir revisores con el rol adecuado para la tarea y la menor cantidad de reviews pendientes, excluyendo al autor del PR.
- **FR-015**: El comentario del agente MUST evaluar el cambio contra los criterios de aceptación de la tarea, justificar cada observación e indicar si no revisó el PR completo.
- **FR-016**: El líder MUST poder cambiar los revisores o editar el comentario antes de aprobar.
- **FR-017**: Al aprobarse, el sistema MUST pedir las reviews y publicar el comentario en el PR, marcado como generado por un agente.
- **FR-018**: El sistema MUST ignorar los PRs que no referencian issues del proyecto.

**Transversales**

- **FR-019**: Toda escritura nueva en GitHub (crear issues, pedir reviews, comentar) MUST pasar por una propuesta aprobada, manual o por auto-aprobar (spec 005).
- **FR-021**: Cuando se edita una tarea ya publicada, el sistema MUST actualizar su issue sin propuesta (título, descripción, criterios, checklist y responsable), porque la publicación ya fue aprobada y el cambio lo hizo una persona.
- **FR-020**: Cada acción hecha en GitHub MUST quedar registrada en la actividad del proyecto: qué, cuándo y qué propuesta la autorizó.

### Key Entities *(include if feature involves data)*

- **Repositorio conectado**: el repo `owner/nombre` del proyecto. Uno por proyecto, con su estado de conexión.
- **Vínculo tarea ↔ issue**: une una tarea con su issue (número, link y estado). Una tarea tiene como máximo una issue.
- **Vínculo tarea ↔ PR**: une una tarea con los PRs que la resuelven.
- **Propuesta de acción en GitHub**: una propuesta (spec 005) que describe lo que se va a escribir en GitHub: issues a crear, o revisores y comentario de una revisión.
- **Revisión sugerida**: revisores propuestos con su justificación y el comentario del agente para un PR.
- **Usuario de GitHub del miembro**: dato extra del miembro (spec 001) para asignar issues y pedir reviews.

### Dependencies

- **003**: las tareas que se publican salen del tablero.
- **005**: todas las escrituras en GitHub son propuestas con aprobación.
- **001**: el usuario de GitHub es un dato del miembro; hay que acordar con sandredev si se carga al crear el equipo o solo en Integraciones.
- **007 → 008**: qué eventos de GitHub llegan y cómo mueven las tareas lo define la 008; esta spec solo usa el evento "PR abierto" para la revisión (contrato en [specs/README.md](../README.md)).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El líder conecta el repo en menos de 1 minuto, sin salir de la herramienta.
- **SC-002**: El 100% de las tareas aprobadas para publicar termina con exactamente una issue vinculada, o con un error visible que se puede reintentar.
- **SC-003**: La propuesta de revisión aparece en menos de 2 minutos desde que se abre un PR vinculado.
- **SC-004**: En al menos el 80% de las propuestas de revisión, el líder aprueba los revisores sugeridos sin cambiarlos.
- **SC-005**: Ninguna issue, pedido de review o comentario nuevo llega a GitHub sin una propuesta aprobada que lo respalde.
- **SC-006**: Un cambio en una tarea publicada se ve en su issue en menos de 1 minuto.
