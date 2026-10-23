# Feature Specification: 012 · Visual plan views

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: UC-07 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: how the plan screen (spec 009, User Story 4) draws the roadmap, the methodology and the architecture. Today the three parts are cards full of rows that look the same; this spec turns each one into a picture that explains itself: a timeline, a flow and a map.
- **Doesn't include**: new plan data or new endpoints. Everything is drawn from what spec 004 already returns.
- **Doesn't include**: arrows between architecture components. The agents don't say which component talks to which yet; adding that is a change to the architecture stage (spec 002) and its view (spec 004), left for later.
- **Doesn't include**: editing the plan from these views (spec 004 already rules it out).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The roadmap as a timeline (Priority: P1)

The leader opens the roadmap and sees the project's weeks across the top, each phase as a bar from its first week to its last one, and its epics as thinner bars under it. Each bar fills as its work gets done. The current week stands out across the whole timeline, and each phase's deliverables appear as milestones at its end.

**Why this priority**: "how are we doing?" is the question the roadmap answers, and a timeline answers it in one look. It's also the view that appears most in the demo after the board.

**Independent Test**: on the fake service, open the roadmap of the demo project in week 3 and check that the "Bases" bar covers weeks 1 and 2, that "MVP" starts in week 3, that week 3 stands out and that the "Bases" milestone lists its deliverables.

**Acceptance Scenarios**:

1. **Scenario**: Phases in time
   - **Given** an approved roadmap with "Bases" (weeks 1 to 2) and "MVP" (weeks 3 to 4)
   - **When** the leader opens the roadmap
   - **Then** there is one column per week, "Bases" is a bar over weeks 1 and 2 and "MVP" a bar over weeks 3 and 4

2. **Scenario**: Progress inside the bars
   - **Given** epic EP-1 with 6 of 12 points done
   - **When** the leader looks at its bar
   - **Then** half of the bar is filled, and the text next to it says "6 de 12 pts"

3. **Scenario**: Today
   - **Given** the project is in week 3
   - **When** the leader opens the roadmap
   - **Then** week 3 is highlighted from the top of the timeline to the bottom and its header says it's the current week

4. **Scenario**: Milestones
   - **Given** "Bases" has the deliverables "Repo y CI" and "Proyecto y equipo"
   - **When** the leader opens the roadmap
   - **Then** a milestone at the end of "Bases" (week 2) shows those deliverables

5. **Scenario**: No board yet
   - **Given** a roadmap approved before the board exists
   - **When** the leader opens it
   - **Then** the bars are drawn empty, no week is highlighted, and a sentence says progress appears when the board exists

6. **Scenario**: Narrow screen
   - **Given** a 360 px wide screen
   - **When** the leader opens a 12-week roadmap
   - **Then** the timeline scrolls sideways inside its card while the phase and epic names stay visible; the page itself doesn't scroll sideways

---

### User Story 2 - The methodology as a flow (Priority: P2)

The leader opens the methodology and sees how the team works as two flows. The first is the iteration: the ceremonies in the order they happen, ending with "se repite cada 2 semanas" (or "flujo continuo" for Kanban). The second is the board: its columns from "Por hacer" to "Hecho", each showing its work-in-progress limit as slots. The discarded alternatives stay below, short.

**Why this priority**: it explains the methodology better than a list, but the decision and its rationale are already visible today.

**Independent Test**: open the methodology of the demo project and check that the ceremonies read Planning, Daily, Retro, followed by "Se repite cada 2 semanas", and that "En curso" shows 3 slots and "En revisión" 2.

**Acceptance Scenarios**:

1. **Scenario**: The iteration
   - **Given** Scrumban with 2-week iterations and the ceremonies Daily, Planning and Retro
   - **When** the leader opens the methodology
   - **Then** the ceremonies appear in the order they happen (Planning, Daily, Retro), each with its frequency and purpose, and the flow ends with "Se repite cada 2 semanas"

2. **Scenario**: Continuous flow
   - **Given** Kanban
   - **When** the leader opens the methodology
   - **Then** the flow ends with "Flujo continuo, sin iteraciones"

3. **Scenario**: WIP limits as slots
   - **Given** limits of 3 in "En curso" and 2 in "En revisión"
   - **When** the leader looks at the board flow
   - **Then** "En curso" shows 3 slots and says "Máximo 3 a la vez", "En revisión" shows 2, and the columns without a limit say "Sin límite"

---

### User Story 3 - The architecture as a map (Priority: P2)

The leader opens the architecture and sees the system as layers, in the order of the stack (for example Frontend, Backend, IA), each layer with its technology and the components that run on it. Components that don't match any layer appear together in a last group. The decisions show as their titles; each one opens to show what was decided and why.

**Why this priority**: it turns three lists into one picture of the system, but the content is already readable today.

**Independent Test**: open the architecture of the demo project and check that "App web" sits in the Frontend layer, "API" in Backend, "Agentes" in IA and "Base de datos" in the last group, and that a decision opens with Enter.

**Acceptance Scenarios**:

1. **Scenario**: Components inside their layer
   - **Given** the stack Frontend (React + Tailwind), Backend (FastAPI), IA (Gemini) and the components "App web" (React + Vite), "API" (FastAPI), "Agentes" (Gemini) and "Base de datos" (SQLite)
   - **When** the leader opens the architecture
   - **Then** each component appears inside the layer whose technology it shares, and "Base de datos" appears in the "Otras piezas" group

2. **Scenario**: Decisions folded
   - **Given** an architecture with three decisions
   - **When** the leader opens the architecture
   - **Then** they see the three titles; opening one shows its decision and rationale

---

### Edge Cases

- What if a phase lasts one week? Its bar covers exactly one column and still reads as a bar.
- What if the plan is overdue (the current week is past the last one)? No week is highlighted; the summary already says the plan has ended (spec 004).
- What if a phase has no deliverables? It has no milestone.
- What if an epic has no tasks? Its bar is drawn empty and says "Sin tareas".
- What if a ceremony has a name that isn't a known one? It keeps the order the agent gave, after the known ones.
- What if no WIP limits exist? The board flow is still drawn, every column says "Sin límite".
- What if every component matches a layer? There is no "Otras piezas" group.
- What if the stack is empty? All the components appear in one group named "Componentes".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The roadmap MUST be a timeline with one column per week of the plan, one bar per phase spanning its weeks and one bar per epic under its phase, each filled by its points done.
- **FR-002**: The current week MUST be highlighted across the whole timeline when the board exists and the plan isn't overdue.
- **FR-003**: Each phase with deliverables MUST show a milestone at its last week listing them.
- **FR-004**: On narrow screens the timeline MUST scroll inside its card, with the names always visible.
- **FR-005**: The methodology MUST show the ceremonies as a flow in the order they happen, ending with how the iteration repeats, and the board columns as a flow with their WIP limits drawn as slots.
- **FR-006**: The architecture MUST show the stack layers in order with the components that share their technology inside them, and the rest in a last group; decisions MUST be folded and open with the mouse or the keyboard.
- **FR-007**: Every picture MUST have a text equivalent for screen readers (for example "Bases, semanas 1 a 2, 2 de 13 pts hechos"), and color MUST NOT be the only way to read a state (spec 009, FR-009).
- **FR-008**: The views MUST follow the design system: no separator lines (the current week is a highlighted column, not a line), at most three numbers per screen, states as icon plus word (spec 009, FR-002).
- **FR-009**: The summary (current week, percent done, current phase) and where each part came from (`ViewOrigin`) MUST stay as they are.

### Key Entities

- **Roadmap, methodology and architecture views**: the same ones of spec 004. No new fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Looking at the roadmap for five seconds is enough to say which phase the team is in and which phase is behind (checked with two people outside the team).
- **SC-002**: The three parts render on the fake service without errors at 360, 768 and 1440 px, in both themes.
- **SC-003**: None of the three views shows the same row style for every block, as they do today.
