# Feature Specification: 001 · Alta de proyecto y equipo

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: sandredev  
**Reviewer**: codigotpx  
**Use cases**: UC-01, UC-02 ([plan/use-cases.md](../../plan/use-cases.md))  

## Alcance

- **Incluye**: el servicio (backend) que permite crear, consultar y editar un proyecto con su equipo, validar los datos y dejar el proyecto listo para que arranquen los agentes (UC-03).
- **Incluye**: las pantallas para crear, ver y editar el proyecto y su equipo. Son el primer paso de la demo (constitución, principio 1), y cada dueño hace su área de punta a punta ([specs/README.md](../README.md)). Las historias también se pueden probar directamente contra el servicio.
- **No incluye**: la generación del plan (spec 002) ni el pedido de empezar a planificar (spec 002), ni la re-planificación (spec 008). Esta spec deja el proyecto listo y avisa cuando cambia el equipo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un proyecto con su equipo (Priority: P1)

El líder carga qué quiere construir (nombre, descripción, duración en semanas), si quiere elige la metodología, decide si las propuestas de los agentes se aprueban solas, y carga a su equipo: cada miembro con nombre, rol, seniority, horas por semana y skills. El sistema guarda el proyecto en estado borrador, con su equipo, y queda listo para que los agentes empiecen a planificar.

**Why this priority**: es el primer paso de la demo (constitución, principio 1). Sin proyecto y equipo, los agentes no tienen nada que planificar.

**Independent Test**: se envía un proyecto con dos miembros al servicio y se verifica que la respuesta trae el proyecto con identificador, estado borrador y los dos miembros con sus datos. Al consultarlo después, los datos son los mismos.

**Acceptance Scenarios**:

1. **Scenario**: Alta completa
   - **Given** no existe ningún proyecto
   - **When** el líder crea "Tienda online" (8 semanas, metodología Scrum, auto-aprobar desactivado) con una desarrolladora senior de 40 h y un diseñador junior de 20 h
   - **Then** el proyecto queda guardado en estado borrador, con metodología Scrum, auto-aprobar desactivado y los dos miembros con su rol, seniority, horas y skills

2. **Scenario**: Metodología sin elegir
   - **Given** el líder no indica metodología
   - **When** crea el proyecto
   - **Then** queda en "que recomienden los agentes", y los agentes van a proponer una (spec 002)

3. **Scenario**: Valores por defecto de un miembro
   - **Given** el líder carga un miembro solo con nombre y rol
   - **When** crea el proyecto
   - **Then** el miembro queda con seniority intermedia, 20 h por semana y sin skills

4. **Scenario**: Datos inválidos
   - **Given** el líder no carga ningún miembro, o pone duración 0, o deja el nombre vacío
   - **When** intenta crear el proyecto
   - **Then** no se guarda nada y la respuesta indica qué campo está mal y por qué

5. **Scenario**: Nombres repetidos
   - **Given** el líder carga dos miembros llamados "Ana"
   - **When** intenta crear el proyecto
   - **Then** no se guarda nada y la respuesta indica que cada miembro necesita un nombre distinto

6. **Scenario**: Crear no arranca la planificación
   - **Given** un proyecto recién creado
   - **When** el líder todavía no pidió planificar
   - **Then** el proyecto sigue en borrador y ningún agente empieza a trabajar. La planificación arranca con un pedido aparte, definido en la spec 002 (UC-03)

---

### User Story 2 - Consultar un proyecto (Priority: P1)

El líder o un miembro piden un proyecto y reciben todos sus datos y su equipo, tal como quedaron guardados.

**Why this priority**: lo necesitan la edición (historia 3), los agentes (spec 002) y las vistas del plan (spec 004).

**Independent Test**: se crea un proyecto, se lo pide por su identificador y se compara con lo enviado. Pedir un identificador que no existe devuelve "no encontrado".

**Acceptance Scenarios**:

1. **Scenario**: Proyecto existente
   - **Given** existe el proyecto "Tienda online" con dos miembros
   - **When** se pide por su identificador
   - **Then** se reciben sus datos, su estado y los dos miembros

2. **Scenario**: Proyecto inexistente
   - **Given** no existe ningún proyecto con ese identificador
   - **When** se pide
   - **Then** la respuesta es "no encontrado" y no se crea nada

---

### User Story 3 - Editar el proyecto y el equipo (Priority: P2)

El líder cambia datos del proyecto (nombre, descripción, duración, metodología, auto-aprobar) o del equipo: agrega miembros, quita miembros o cambia el rol, seniority, horas o skills de alguno. Solo cambia lo que el líder indica; el resto queda igual.

**Why this priority**: los equipos cambian (alguien entra, alguien se va, cambian las horas) y el plan tiene que poder ajustarse. Para la demo alcanza con crear, por eso va después.

**Independent Test**: se crea un proyecto con dos miembros, se agrega un tercero y se cambian las horas de uno; al consultarlo, tiene tres miembros, las horas nuevas y el resto de los datos sin cambios.

**Acceptance Scenarios**:

1. **Scenario**: Cambio parcial
   - **Given** un proyecto con auto-aprobar desactivado
   - **When** el líder solo activa auto-aprobar
   - **Then** auto-aprobar queda activo y nombre, descripción, duración, metodología y equipo no cambian

2. **Scenario**: Agregar, editar y quitar miembros
   - **Given** un proyecto con Ana y Beto
   - **When** el líder agrega a Carla, cambia las horas de Ana a 30 y quita a Beto
   - **Then** el equipo queda con Ana (30 h) y Carla, y Beto ya no figura

3. **Scenario**: Dejar el equipo vacío
   - **Given** un proyecto con un solo miembro
   - **When** el líder intenta quitarlo
   - **Then** no se aplica ningún cambio y la respuesta indica que el equipo necesita al menos un miembro

4. **Scenario**: Proyecto inexistente
   - **Given** no existe ningún proyecto con ese identificador
   - **When** el líder intenta editarlo
   - **Then** la respuesta es "no encontrado"

---

### User Story 4 - Avisar que cambió el equipo (Priority: P3)

Cuando el líder cambia el equipo, el sistema guarda el cambio y avisa que el equipo cambió, con el detalle de quién entró, quién salió y qué se editó. Esta spec solo da el aviso; qué se hace con él lo deciden otras specs: la actividad en vivo lo muestra (spec 005) y, si ya hay un plan aplicado, los agentes proponen re-planificar (spec 008, FR-010). Esta spec no re-planifica nada (constitución, principio 8).

**Why this priority**: es lo que permite que el plan no quede desalineado con el equipo real, pero la re-planificación en sí es ronda 3 (spec 008).

**Independent Test**: se agrega un miembro y se quita otro; queda publicado un único aviso "cambió el equipo" con los dos cambios. Cambiar solo el nombre del proyecto no publica ningún aviso.

**Acceptance Scenarios**:

1. **Scenario**: Cambio de equipo
   - **Given** un proyecto con Ana y Beto
   - **When** el líder agrega a Carla y quita a Beto en la misma edición
   - **Then** el cambio se guarda y se publica un solo aviso "cambió el equipo" que indica que entró Carla y salió Beto

2. **Scenario**: Cambio que no afecta al equipo
   - **Given** un proyecto con plan aplicado
   - **When** el líder solo cambia el nombre, la descripción o auto-aprobar
   - **Then** el cambio se guarda y no se publica el aviso

3. **Scenario**: Edición inválida
   - **Given** un proyecto con un solo miembro
   - **When** el líder intenta quitarlo
   - **Then** no se guarda nada y no se publica el aviso

---

### Edge Cases

- **Editar mientras se planifica**: con aprobación manual, "planificando" puede durar horas o días, así que el equipo, el nombre, la descripción y auto-aprobar se pueden cambiar. Las etapas ya aprobadas no cambian y las siguientes usan el equipo nuevo (igual que la spec 002). Lo único que no se puede cambiar es la metodología, porque la etapa de metodología ya la usó o la está usando; se rechaza con un mensaje claro.
- **Quitar un miembro con tareas asignadas**: sus tareas pendientes quedan sin asignar (no se borran) hasta que se re-planifique (spec 008). Las tareas hechas conservan el nombre de quien las hizo.
- **Dos miembros con el mismo nombre**: no se permite dentro de un proyecto, porque los agentes asignan el trabajo por nombre (spec 002). La comparación ignora mayúsculas y espacios sobrantes ("ana " y "Ana" se consideran el mismo nombre).
- **Renombrar un miembro**: no cambia de quién son sus tareas; las tareas siguen asignadas a esa persona con su nombre nuevo.
- **Skills repetidas o con espacios**: se guardan sin duplicados y sin espacios sobrantes.
- **Textos con solo espacios**: un nombre de proyecto, nombre de miembro o rol que sea solo espacios se trata como vacío.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir crear un proyecto con nombre, descripción, duración en semanas, metodología (opcional), auto-aprobar y al menos un miembro.
- **FR-002**: El sistema DEBE aceptar como metodología "que recomienden los agentes" (por defecto), Scrum, Kanban, Scrumban, XP o Shape Up, y rechazar cualquier otra.
- **FR-003**: El sistema DEBE guardar de cada miembro nombre, rol, seniority (junior, intermedio o senior; intermedio por defecto), horas por semana (20 por defecto) y skills (vacío por defecto).
- **FR-004**: El sistema DEBE rechazar el alta o la edición si falta el nombre del proyecto, la descripción, el nombre o rol de un miembro, si no hay miembros, si dos miembros tienen el mismo nombre, si la duración no está entre 1 y 52 semanas o si las horas de un miembro no están entre 1 y 60, indicando qué campo falla.
- **FR-005**: Todo proyecto nuevo DEBE quedar en estado borrador. Crear un proyecto NO DEBE arrancar la planificación: eso lo hace un pedido aparte (spec 002).
- **FR-006**: El sistema DEBE devolver un proyecto con todos sus datos y su equipo a partir de su identificador, o "no encontrado" si no existe.
- **FR-007**: El sistema DEBE permitir editar cualquier dato del proyecto o del equipo cambiando solo lo indicado, también mientras el proyecto está "planificando".
- **FR-008**: Una edición inválida NO DEBE aplicar ningún cambio (todo o nada).
- **FR-009**: El sistema DEBE rechazar el cambio de metodología una vez que la planificación arrancó.
- **FR-010**: Toda edición que agregue o quite miembros, o cambie el nombre, rol, seniority, horas o skills de alguno, DEBE publicar un único aviso "cambió el equipo" con el detalle de los cambios. Las ediciones que no tocan el equipo NO DEBEN publicarlo.
- **FR-011**: El sistema DEBE funcionar sin key de Gemini (modo mock, constitución principio 6).

### Key Entities *(include if feature involves data)*

- **Proyecto**: lo que el equipo quiere construir. Nombre, descripción, duración en semanas, metodología pedida, auto-aprobar, estado (borrador, planificando, listo, error), equipo y fecha de creación. El plan aprobado y el repo de GitHub se completan en otras specs.
- **Miembro**: persona del equipo de un proyecto. Nombre, rol, seniority, horas por semana y skills. Pertenece a un solo proyecto. El usuario de GitHub lo agrega la spec 007, desde Integraciones (007, FR-012).
- **Aviso "cambió el equipo"**: indica que el equipo de un proyecto cambió, con el detalle de quién entró, quién salió y qué se editó de cada miembro. Lo muestra la actividad en vivo (spec 005) y lo usa la re-planificación (spec 008).

### Contratos con otras specs (acordados con Mitchz01)

- **001 → 002**: los agentes reciben del proyecto el nombre, la descripción, la duración, la metodología pedida y el equipo completo (nombre, rol, seniority, horas y skills de cada miembro). No reciben auto-aprobar, que solo afecta a las propuestas (spec 005). El pedido de "empezar a planificar" y la regla de una sola planificación activa los define la spec 002.
- **001 → 008**: el aviso "cambió el equipo" se publica ante cualquier cambio de miembros (altas, bajas y cambios de nombre, rol, seniority, horas o skills). Qué cambios disparan una re-planificación lo decide la spec 008: altas, bajas y cambios de rol, seniority u horas; renombrar o cambiar skills no (008, FR-010). Con auto-aprobar activo, editar el equipo **no** reorganiza el tablero solo: las re-planificaciones automáticas siempre esperan al líder (008, FR-016).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Crear, consultar o editar un proyecto con su equipo responde en menos de 1 segundo.
- **SC-002**: El 100 % de los datos enviados al crear o editar se recuperan iguales al consultar el proyecto.
- **SC-003**: El 100 % de los casos inválidos de FR-004 se rechazan sin guardar nada y con un mensaje que nombra el campo.
- **SC-004**: Todos los escenarios de aceptación de las historias 1 a 4 se verifican con pruebas automáticas, sin key de Gemini.
