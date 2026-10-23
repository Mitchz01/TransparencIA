# Feature Specification: Public-sector language and a work plan the evidence keeps up to date

**Created**: 2026-10-23  
**Status**: Draft

The people who use the app run public projects (a foundation restoring a mangrove for Corpamag, an
alcaldía's works office). They know contracts, activities, deliverables and supervision; they don't know
software development. Today the app still talks like a software tool: sprints, Scrum, backlog, epics,
story points, GitHub, architecture, specs. This feature makes every screen speak the language of public
projects, makes the agents plan public projects with those same words, and lets the evidence the team
uploads (spec 017) keep the work plan up to date with the AI's help.

No methodology is chosen any more: every project is planned and followed **by stages** (etapas), the way
public contracts are run.

## Glossary (the words the UI uses)

| Today (software) | From now on (public projects) |
|---|---|
| Sprint | Etapa |
| Roadmap, its phases | Cronograma, sus fases |
| Backlog (stage and column) | Actividades (stage); "Por programar" (column) |
| Story, task | Actividad |
| Epic | Componente |
| Story points, pts | Peso |
| Acceptance criteria | Criterios de cumplimiento |
| Checklist | Pasos |
| Sprint goal / objectives | Metas de la etapa |
| Capacity, velocity | Carga del equipo, ritmo de avance |
| Board (Tablero) | Actividades |
| Plan (views) | Plan de trabajo |
| Columns Backlog, Por hacer, En curso, En revisión, Hecho | Por programar, Por hacer, En ejecución, En verificación, Terminada |
| Close the sprint | Cerrar la etapa |
| Replanning | Ajuste del plan de trabajo |
| Analysis | Diagnóstico |
| Methodology | Forma de trabajo (always "Por etapas") |
| Architecture (style, components, stack, decisions) | Componentes y recursos (modalidad, componentes, recursos e insumos, decisiones) |
| Agents: product analyst, agile coach, software architect, product manager, product owner, Scrum master | Analista del proyecto, Asesor de planeación, Coordinador técnico, Coordinador del proyecto, Planificador de actividades, Planificador de etapas |
| Role / seniority junior, mid, senior | Cargo / experiencia básica, intermedia, alta |
| Task types feature, bug, chore, spike | Not shown |
| GitHub, issues, PRs, repository, specs, diagrams | Not shown |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every screen in plain public-project words (Priority: P1)

A project leader who has never worked in software creates a project, follows the planning, works the
activities and registers evidence, and every word on the way is one they already use at work.

**Why this priority**: the users are public officials and foundation staff; a screen that says "sprint"
or "backlog" loses them, and the jury, in the first minute.

**Independent Test**: walk the demo's path (sign in, new project, planning, activities, plan de trabajo,
team, Transparencia) and check that none of the "Today" words of the glossary appears.

**Acceptance Scenarios**:

1. **Scenario**: The activities screen
   - **Given** a planned project
   - **When** the leader opens Actividades
   - **Then** they see the stages ("Etapa 2: Vivero"), the columns Por programar, Por hacer, En ejecución,
     En verificación and Terminada, and each activity with its component, weight and steps
2. **Scenario**: The planning
   - **When** the agents plan a project
   - **Then** the stages read Diagnóstico, Forma de trabajo, Componentes y recursos, Cronograma,
     Actividades and Etapas, each with its agent's public-project name
3. **Scenario**: Messages
   - **When** the app explains something (a toast, an empty state, an activity in the feed, the reason
     of a plan adjustment)
   - **Then** it uses the glossary's words and is in Spanish

---

### User Story 2 - The agents plan public projects (Priority: P1)

The leader describes the project (or it comes from the contract, spec 017 US7) and the agents return a
plan a public entity recognizes: a diagnosis, the work by stages, the project's components and the
resources it needs, a schedule by phases, the activities with their weight and compliance criteria, and
the stages with their goals.

**Why this priority**: the words on screen are only half of it; if the agents still propose a "modular
monolith" or "US-12: login with Google", the demo breaks.

**Independent Test**: plan the mangrove project from its description, with the real key and in mock
mode, and check the plan has no software concept.

**Acceptance Scenarios**:

1. **Scenario**: No methodology to choose
   - **When** the leader creates a project
   - **Then** there is no methodology field, and the plan is always organized by stages
2. **Scenario**: Components and resources instead of architecture
   - **Then** that stage lists the project's components (vivero, siembra, monitoreo, talleres) and its
     resources (plántulas, lanchas, mano de obra local), never a technology stack
3. **Scenario**: Activities
   - **Then** each activity has a code like "A-3", a component, a weight, compliance criteria and steps;
     nothing says story, epic, bug or story points
4. **Scenario**: Mock mode
   - **Given** no AI key
   - **Then** the plan the mock agents return is a public project too

---

### User Story 3 - The evidence updates the work plan with the AI (Priority: P1)

When a member confirms evidence tied to an activity (an invoice, a field photo, a report; spec 017 US2),
the AI looks at the work plan and proposes how it should change: mark that activity as finished, and, if
the project is behind, move pending activities to a later stage. The leader sees the proposal with the AI's
reasons and approves it, removes the changes they don't want, or rejects it. Nothing changes until they
approve.

**Why this priority**: it's what makes the plan "keep itself up to date": the team works in the field and
uploads evidence; it doesn't move cards.

**Independent Test**: confirm the field photo of "Sembrar lote 1", see the proposal "A-5 queda
terminada", approve it, and check the activity is finished and physical progress went up in the portal.

**Acceptance Scenarios**:

1. **Scenario**: Evidence of a finished activity
   - **Given** an activity in progress and its field photo, with no alerts
   - **When** a member confirms the evidence
   - **Then** within a minute the leader gets a plan adjustment proposing to finish that activity, with
     the reason "Se confirmó la evidencia … de la actividad A-5 (Sembrar lote 1)"
2. **Scenario**: Approve
   - **When** the leader approves it
   - **Then** the activity moves to Terminada, its finish date is the approval day, and the portal's
     physical progress and weekly timeline include it
3. **Scenario**: Evidence with alerts
   - **Given** evidence that carries an alert (spec 017)
   - **Then** the AI doesn't propose finishing the activity; the proposal says the evidence needs review
4. **Scenario**: Several evidences in a row
   - **When** two pieces of evidence are confirmed before the leader decides
   - **Then** there is one pending adjustment that covers both reasons
5. **Scenario**: Evidence without an activity
   - **Given** evidence with no activity (e.g. an invoice charged only to a budget line)
   - **Then** no adjustment is proposed

---

### User Story 4 - Software-only features are gone from the screens (Priority: P2)

The leader never runs into GitHub, issues, repositories, generated specs or diagrams, WIP limits, task
types or a technology stack.

**Why this priority**: spec 017 already hid GitHub and documents from the navigation; some pieces still
show inside other screens.

**Independent Test**: open every screen of the demo's path and the task panel, the team and the profile,
and check none of those features appears.

**Acceptance Scenarios**:

1. **Scenario**: An activity's panel
   - **When** the leader opens an activity
   - **Then** there's no issue badge, no GitHub section and no type
2. **Scenario**: The team and the profile
   - **Then** there's no GitHub user field, and the role and experience examples are public-project ones

---

### Edge Cases

- A project planned before this feature (with sprints named "Sprint 1"): its names stay as they were, but
  every label around them uses the new words.
- Evidence confirmed in a project whose plan isn't applied yet: no adjustment (there's no plan to update).
- The AI fails while proposing the adjustment: the evidence stays confirmed; the leader sees "No se pudo
  proponer el ajuste" in the feed and can ask for an adjustment by hand.
- The leader removes the "finish" change and approves the rest: the activity stays where it was.
- An activity finished by hand before the proposal is approved: that change is skipped, like any change
  whose activity moved (spec 008).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every text the team app shows MUST use the glossary's words, in Spanish; the "Today" words
  MUST NOT appear in the screens of the leader's and the members' journey.
- **FR-002**: Project creation MUST NOT ask for a methodology; every project MUST be planned by stages.
- **FR-003**: The planning agents MUST plan public projects: a diagnosis, the work by stages with its
  follow-up meetings, the components and resources, a schedule by phases, activities (code, component,
  weight, compliance criteria, steps) and stages with goals. They MUST NOT propose technology, code or
  software roles unless the project's description is about software.
- **FR-004**: The mock agents MUST return a public project's plan (the mangrove of spec 017).
- **FR-005**: Confirming evidence tied to an activity MUST start a plan adjustment proposed by the AI,
  with the evidence as its reason, which waits for the leader.
- **FR-006**: A plan adjustment MUST be able to finish an activity, besides moving, reassigning, adding
  and discarding (spec 008).
- **FR-007**: The AI MUST NOT propose finishing an activity whose evidence carries alerts.
- **FR-008**: Nothing in the work plan changes until the leader approves the adjustment (constitution,
  principle 8).
- **FR-009**: GitHub, issues, repositories, generated specs and diagrams, WIP limits, task types and the
  technology stack MUST NOT be shown.
- **FR-010**: The reasons of automatic adjustments (team changes, a stage closed with pending activities,
  confirmed evidence) MUST be in Spanish, with the glossary's words.

### Key Entities

No new entity. The existing ones get public-project names on screen: stage (sprint), activity (task),
component (epic), weight (points), steps (checklist), plan adjustment (replan). A plan adjustment gains
one kind of change: finishing an activity.

## Success Criteria *(mandatory)*

- **SC-001**: None of the glossary's "Today" words appears in the demo's path (checked screen by screen).
- **SC-002**: A person with no software background reads the activities screen and the planning and can
  say what each part means, without help.
- **SC-003**: From confirming a field photo to seeing the adjustment proposal takes under 1 minute.
- **SC-004**: Planning the mangrove project, with the real key and in mock mode, gives a plan with no
  software concept.

## Out of scope

- Renaming code, API fields or database tables (sprint, task, epic, points stay inside).
- Changing how the activities screen looks (columns stay).
- Approving adjustments automatically from evidence.
- Other languages.
