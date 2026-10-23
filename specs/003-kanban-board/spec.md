# Feature Specification: 003 · Kanban board and sprints

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: codigotpx  
**Reviewer**: Mitchz01  
**Use cases**: UC-05, UC-06 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

When the leader approves the plan, the work shows up on a ready-to-use board: sprints, cards with priority, points, owner and checklist. From there the team moves cards, edits them and checks off their steps.

Board columns, in order: **Backlog**, **To do**, **In progress**, **In review**, **Done**.

### User Story 1 - The approved plan becomes a board (Priority: P1)

When the last stage of the plan (sprints) is approved, the leader sees the board built without entering anything by hand. Each backlog story is a card inside its sprint, with its priority, points, acceptance criteria, a checklist and the assigned member.

**Why this priority**: it's the end of the demo (project → plan → approval → board, constitution principle 1). Without it, the plan stays as text and nobody can work on it.

**Independent Test**: with an approved plan from mock mode (no API key), open the board and verify that each story appears exactly once, in its sprint and with all its data.

**Acceptance Scenarios**:

1. **Scenario**: Plan approved manually
   - **Given** a project with the plan stages approved up to the backlog
   - **When** the leader approves the sprints stage
   - **Then** the board shows one sprint per plan iteration, each story as a card in "To do" inside its sprint, and the project moves to "ready"

2. **Scenario**: Plan with auto-approve
   - **Given** a project with auto-approve on
   - **When** the agent finishes the sprints stage
   - **Then** the board builds itself, same as the previous scenario

3. **Scenario**: Assignment by name
   - **Given** the agent assigned a story to "Ana" and the team has a member named "Ana"
   - **When** the board is built
   - **Then** the card is assigned to Ana

4. **Scenario**: Assignment by role when the name doesn't match
   - **Given** the agent assigned a story to a name that isn't on the team, and the story asks for the "Backend" role
   - **When** the board is built
   - **Then** the card is assigned to the "Backend" member with the fewest points assigned in that sprint

5. **Scenario**: Nobody covers the role
   - **Given** a story asks for the "UX Design" role and nobody on the team has it
   - **When** the board is built
   - **Then** the card stays unassigned and flagged as "missing role: UX Design"

6. **Scenario**: Initial checklist
   - **Given** a story with three acceptance criteria
   - **When** the board is built
   - **Then** the card has a three-item unchecked checklist, one per criterion

---

### User Story 2 - Move cards between columns (Priority: P1)

A member drags a card from one column to another (for example, from "To do" to "In progress") or reorders it within the column. The change is saved.

**Why this priority**: it's the basic interaction of a board; without it, the board is just a list.

**Independent Test**: with a built board, drag a card to another column, reload the page and verify it's still there.

**Acceptance Scenarios**:

1. **Scenario**: Change column
   - **Given** a card in "To do"
   - **When** a member drags it to "In progress"
   - **Then** the card is in "In progress" and stays there after reloading

2. **Scenario**: Reorder within the column
   - **Given** three cards in "To do"
   - **When** a member drags the third one to the top
   - **Then** the new order is kept after reloading

3. **Scenario**: WIP limit exceeded
   - **Given** the methodology sets a limit of 3 cards in "In progress" and there are already 3
   - **When** a member moves a fourth card to "In progress"
   - **Then** the card moves anyway and the column shows a limit-exceeded warning (nothing is blocked: "The user is in charge")

4. **Scenario**: Save fails
   - **Given** the connection to the server is lost
   - **When** a member moves a card
   - **Then** the card goes back to its original place and a message says it couldn't be saved

---

### User Story 3 - Edit a task and its checklist (Priority: P2)

A member opens a card, corrects what the agents generated (title, description, points, priority, owner) and checks off the checklist steps. They can also add, edit or remove steps.

**Why this priority**: everything generated has to be editable (constitution principle 4), and the checklist is a central part of the product. But the board can be demoed without editing.

**Independent Test**: open a card, change its priority, check a checklist item and add a new one; reload and verify the changes.

**Acceptance Scenarios**:

1. **Scenario**: Edit task data
   - **Given** a card with "medium" priority
   - **When** a member changes it to "high" and saves
   - **Then** the card shows "high" priority

2. **Scenario**: Check a step
   - **Given** a card with a 4-item unchecked checklist
   - **When** a member checks one
   - **Then** the card shows "1/4" progress on the board

3. **Scenario**: Add and remove steps
   - **Given** a card with a checklist
   - **When** a member adds an item and removes another
   - **Then** the checklist reflects the changes and the progress is recalculated

4. **Scenario**: Checklist complete
   - **Given** a card in "In progress" with all items but one checked
   - **When** a member checks the last one
   - **Then** the card suggests moving it to "In review", but doesn't move by itself

5. **Scenario**: Reassign
   - **Given** a card unassigned because of a missing role
   - **When** the leader assigns it to a member
   - **Then** the "missing role" flag disappears and the card shows the new owner

---

### User Story 4 - Navigate and reorganize sprints (Priority: P2)

The board shows one sprint at a time, with a selector to switch sprints or see the backlog. The leader can move a card from one sprint to another or back to the backlog, and sees how many points each sprint has against the team's capacity.

**Why this priority**: a real plan has several sprints; without this you only see a pile of mixed cards. It's still useful without reorganizing.

**Independent Test**: with a 3-sprint plan, switch sprints with the selector, move a card from sprint 1 to 2 and verify that both sprints' point totals update.

**Acceptance Scenarios**:

1. **Scenario**: Default sprint
   - **Given** a board with 3 sprints and the first one with pending tasks
   - **When** a member opens the board
   - **Then** they see the first sprint that has unfinished tasks

2. **Scenario**: Move between sprints
   - **Given** a 5-point card in sprint 1
   - **When** the leader moves it to sprint 2
   - **Then** sprint 1 drops 5 points, sprint 2 gains 5, and the card lands in "To do" of sprint 2

3. **Scenario**: Overloaded sprint
   - **Given** a sprint whose points exceed the team's estimated capacity
   - **When** the leader looks at that sprint
   - **Then** an overload warning is shown, without blocking

---

### User Story 5 - Filter the board (Priority: P3)

A member filters the board to see only their cards, or by priority or epic.

**Why this priority**: it improves daily use, but it isn't needed for the demo.

**Independent Test**: turn on the "My tasks" filter and verify that only the cards assigned to that member remain.

**Acceptance Scenarios**:

1. **Scenario**: My tasks
   - **Given** a sprint with cards from several members
   - **When** a member filters by their name
   - **Then** they only see their cards, and the filter is kept when switching sprints

---

### Edge Cases

- What if a backlog story wasn't placed in any sprint? It goes to the "Backlog" column, outside the sprints.
- What if the plan references a story that doesn't exist in the backlog? It's ignored and the leader is warned; no empty card is created.
- What if two members have the same name? It's assigned by role, as if the name didn't match.
- What if the board is built twice for the same plan? No cards are duplicated; planning again is a replan (spec 008).
- What if a member with tasks is removed from the team? Their cards become unassigned and flagged for reassignment, and the system proposes a replan (spec 008, FR-010).
- What if two people move the same card at the same time? The last change wins, and both see it (live activity, spec 005).
- What if a task linked to a GitHub issue is moved by hand? It's respected: the board is the source of truth. A later GitHub event can move it again, but never out of "Done" unless the issue is reopened (spec 008, FR-004).
- What about a story without acceptance criteria? The card gets an empty checklist.
- What if the chosen methodology is Kanban (no iterations)? The board is continuous: all tasks in a single view, no sprint selector and no per-sprint capacity warning. The iterations the agent builds are still saved, with their objective and tasks, but the board doesn't separate them: they're shown as **objectives** that can be used as a filter and that are met the same way as in Scrum (FR-002).

## Requirements *(mandatory)*

### Functional Requirements

**Building the board (UC-05)**

- **FR-001**: The system MUST build the board automatically when the plan's sprints stage is approved, manually or through auto-approve.
- **FR-002**: The system MUST create one sprint per plan iteration, with its number, name and roadmap phase, and an **objective** made of the iteration's goal and its tasks. The objective is met when all its tasks are done (spec 008 closes it).
- **FR-003**: The system MUST create one task per story in the approved backlog, with no duplicates or losses, in the sprint the plan assigned to it.
- **FR-004**: Each task MUST keep from the story: key (US-n), epic, title, description, acceptance criteria, type, points and priority.
- **FR-005**: The system MUST generate each task's initial checklist with one item per acceptance criterion.
- **FR-006**: The system MUST assign each task to the member the agent named; if the name doesn't match, to the member with the requested role and the fewest points in that sprint; if nobody has the role, it leaves it unassigned and flagged with the missing role.
- **FR-007**: Tasks the plan didn't place in any sprint MUST stay in "Backlog".
- **FR-008**: When the board is built, the project MUST move to "ready" and the board MUST be available to the whole team.

**Working on the board (UC-06)**

- **FR-009**: Users MUST be able to move a card between the Backlog, To do, In progress, In review and Done columns, and reorder it within a column.
- **FR-010**: The system MUST save every move and show it the same way after reloading or from another device.
- **FR-011**: If a move can't be saved, the card MUST go back to its place and the user MUST see a warning.
- **FR-012**: The system MUST warn, without blocking, when a column exceeds the WIP limit defined by the approved methodology.
- **FR-013**: Users MUST be able to edit a task's title, description, points, priority and owner.
- **FR-014**: Users MUST be able to check, uncheck, add, edit and remove checklist items; the card MUST show the progress (checked over total).
- **FR-015**: When the checklist is complete, the system MUST suggest moving the card forward, without moving it by itself.
- **FR-016**: Users MUST be able to switch sprints with a selector, see the backlog and move cards between sprints or to the backlog. If the methodology is Kanban, the board MUST be continuous and the iterations are shown as objectives (see edge cases).
- **FR-017**: The system MUST show each sprint's total points against the team's capacity and warn when it's overloaded. Capacity is estimated automatically from each member's hours per week, their seniority and the sprint length, with the same rule the agents use to build the sprints (spec 002, FR-010), so a freshly generated plan never shows up as overloaded; the leader MUST be able to replace it with a fixed number of points per sprint (for example, when they already know the team's real velocity).
- **FR-018**: Users MUST be able to filter the board by owner, priority and epic.
- **FR-019**: Every board change MUST be published as project activity so others see it live (spec 005).

### Key Entities *(include if feature involves data)*

- **Sprint**: an iteration of the project. Number, name, objective and the roadmap phase it belongs to. Groups tasks.
- **Objective**: a sprint's goal together with its tasks. It's met when all of them are done; spec 008 closes it. With Kanban, it's the only visible trace of each iteration.
- **Task (card)**: a unit of work that comes from a story. Key, epic, title, description, acceptance criteria, type, points, priority, column, position within the column, sprint (or backlog) and owner (or missing role).
- **Checklist item**: a concrete step of a task. Text and whether it's done.
- **WIP limit**: maximum cards per column according to the approved methodology. It only produces warnings.
- **Member**: comes from spec 001. Its name, role and hours are used to assign and to compute capacity.

### Dependencies

- **005 → 003**: building the board starts when the sprints stage is approved. Agree with sandredev on what data the approval carries (`PlanApplied` contract in [specs/README.md](../README.md)).
- **002**: the shape of the backlog and sprints the agents generate, and the capacity rule, which has to be the same in both specs.
- **005**: the board events shown in the live activity feed (contract 003, 005).
- **008**: closes the objectives and proposes a replan when the team changes or a sprint ends with pending work.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The board appears less than 5 seconds after approving the sprints stage.
- **SC-002**: 100% of the approved stories appear as a card exactly once.
- **SC-003**: When the team covers all the roles the plan asks for, at least 90% of the cards are assigned without the leader's intervention.
- **SC-004**: Moving a card is reflected instantly for whoever moves it, and 100% of the saved moves stay the same after reloading.
- **SC-005**: In the demo, a member who never used the tool manages to move a card and check a checklist step on their first try, without help.
