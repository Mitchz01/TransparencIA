# Feature Specification: 004 · Roadmap, methodology and architecture views

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: sandredev  
**Reviewer**: codigotpx  
**Use cases**: UC-07 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: the service (backend) that returns three views of a project's plan, ready to show: the **roadmap** by phases and weeks with its progress, the **methodology** with its ceremonies and discarded alternatives, and the **architecture** with its components, stack and decisions. Each view carries the agent's rationale and how it was decided.
- **Doesn't include**: the screens or drawing the roadmap (frontend). The stories are tested directly against the service; who builds the screens is still to be decided in [specs/README.md](../README.md).
- **Doesn't include**: editing the plan from these views. The plan changes by adjusting proposals (spec 005) or replanning (spec 008). Generated diagrams belong to spec 006.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the roadmap and its progress (Priority: P1)

The leader or a member asks for the project's roadmap and gets the phases in order, each with its goal, start and end week, deliverables and epics. For each epic and each phase they get the real progress: how many tasks it has, how many are done, and the same in points. If the plan is already running, they also know which week of the project they're in.

**Why this priority**: the visual roadmap is what's shown most in the demo after the board, and it answers "how are we doing?".

**Independent Test**: with an applied plan from the mock mode, mark two tasks of an epic as done; the roadmap shows that epic and its phase with two done tasks and their points.

**Acceptance Scenarios**:

1. **Scenario**: Roadmap with progress
   - **Given** an applied plan with the "MVP" phase (weeks 1 to 4) and epic EP-1 with 4 tasks of 3 points each, 2 of them done
   - **When** the roadmap is requested
   - **Then** the "MVP" phase goes from week 1 to week 4, and EP-1 shows 2 of 4 tasks done and 6 of 12 points

2. **Scenario**: Current week
   - **Given** a plan applied 10 days ago
   - **When** the roadmap is requested
   - **Then** it says the project is in week 2 and which phase that week belongs to

3. **Scenario**: Epic without tasks
   - **Given** a roadmap epic to which the backlog assigned no stories
   - **When** the roadmap is requested
   - **Then** the epic shows 0 tasks and is marked "no tasks"

---

### User Story 2 - See the methodology and why it was chosen (Priority: P1)

The leader or a member asks for the project's methodology and gets which one it is, why it was chosen, the iteration length, the ceremonies (name, frequency and purpose), the work-in-progress limits per column and the discarded alternatives with their reason. They also know whether the leader chose it when creating the project or the agents recommended it.

**Why this priority**: it's what sets the product apart (the agents explain the methodology) and one of its principles: "Agent transparency".

**Independent Test**: with the methodology stage approved, request the view and compare it with the approved proposal; also check that it says whether the leader asked for it.

**Acceptance Scenarios**:

1. **Scenario**: Recommended by the agents
   - **Given** a project created without a methodology, where Scrumban was approved
   - **When** the methodology is requested
   - **Then** it returns Scrumban, its rationale, its ceremonies, its WIP limits, the discarded alternatives and that the agents recommended it

2. **Scenario**: Chosen by the leader
   - **Given** a project created with Kanban
   - **When** the methodology is requested
   - **Then** it returns Kanban and that the leader chose it

---

### User Story 3 - See the architecture and its decisions (Priority: P2)

The leader or a member asks for the project's architecture and gets the style (for example, modular monolith), a summary, the components with their responsibility and technology, the stack per layer with its reason, and the architecture decisions (title, decision and why), in the order the agent made them.

**Why this priority**: it helps the technical team get started, but the demo is understandable with the roadmap and the methodology.

**Independent Test**: with the architecture stage approved with 3 decisions, request the view; it has the 3 decisions with their reason, the components and the stack.

**Acceptance Scenarios**:

1. **Scenario**: Approved architecture
   - **Given** the architecture stage approved with 4 components and 3 decisions
   - **When** the architecture is requested
   - **Then** it returns the 4 components, the stack and the 3 decisions with their reason

---

### User Story 4 - Know where each view comes from (Priority: P2)

Each view says which agent made it, its rationale, when it was approved and how: approved by the leader, adjusted by the leader or auto-approved. If the stage isn't approved yet, the view says so ("waiting for approval" or "not generated yet") instead of showing content.

**Why this priority**: it shows that everything went through the leader (constitution, principles 3 and 8), and lets the views be requested while the plan is being built.

**Independent Test**: with analysis and methodology approved and architecture pending, request the views: the methodology has its content and how it was approved; the architecture says "waiting for approval" with no content; the roadmap says "not generated yet".

**Acceptance Scenarios**:

1. **Scenario**: Adjusted by the leader
   - **Given** the roadmap proposal that the leader adjusted before approving
   - **When** the roadmap is requested
   - **Then** it shows the leader's version and says it was adjusted, with the date

2. **Scenario**: Half-built plan
   - **Given** a project with the architecture waiting for approval
   - **When** the views are requested
   - **Then** the architecture says "waiting for approval", without the proposal's content, and the roadmap "not generated yet"

3. **Scenario**: Unknown project
   - **Given** no project exists with that id
   - **When** the views are requested
   - **Then** the answer is "not found"

---

### Edge Cases

- **Project in draft**: the three views say "not generated yet"; it isn't an error.
- **Plan approved but no board yet**: the roadmap is shown without progress (0 tasks) and without a current week, because tasks only exist once the board is built (spec 003).
- **Project finished or late**: if the current week goes beyond the roadmap, the last roadmap week is shown and the plan is marked as overdue.
- **Tasks without an epic, or with an epic that no longer exists**: they count in the project's total progress, but not in any epic or phase.
- **Tasks discarded by a replan**: they don't count in the progress (spec 008).
- **An approved replan that changes the roadmap**: the views always show the latest approved version, never a pending proposal.
- **Methodology without iterations** (Kanban): the iteration length and ceremonies are shown as the agent proposed them; no sprints are made up.
- **Overlapping phases or gaps between weeks**: shown as approved; the roadmap doesn't fix them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST return, from a project's id, the roadmap, methodology and architecture views in a single request, or "not found" if the project doesn't exist.
- **FR-002**: Each view MUST be built only from the final approved (or adjusted) version of its stage; NEVER from a pending, rejected or discarded proposal.
- **FR-003**: Each view MUST state its status: "not generated yet", "waiting for approval" or "approved". If approved, it MUST state the agent, the rationale, the approval date and whether the leader approved it, the leader adjusted it or it was auto-approved.
- **FR-004**: The roadmap MUST return the phases in the approved order, with name, goal, start and end week, deliverables and epics (key, title, description).
- **FR-005**: For each epic and each phase, the roadmap MUST return the number of tasks and of done tasks, and the sum of points and of done points, from the board's tasks. A phase adds up the tasks of its epics.
- **FR-006**: If the board is already built, the roadmap MUST state the project's current week, counting from the day the sprints stage was approved, and the phase that week belongs to.
- **FR-007**: The methodology MUST return the approved methodology, its rationale, iteration length, ceremonies, WIP limits, the discarded alternatives with their reason, and whether the leader chose it when creating the project (spec 001) or the agents recommended it.
- **FR-008**: The architecture MUST return the style, the summary, the components, the stack per layer and the architecture decisions with their reason, in the approved order.
- **FR-009**: Requesting the views MUST NOT change anything in the project, the plan or the board.
- **FR-010**: The system MUST work without a Gemini key (mock mode, constitution principle 6).

### Key Entities *(include if feature involves data)*

- **Plan view**: what's shown of an approved stage (roadmap, methodology or architecture), with its status and where it comes from (agent, rationale, date and how it was approved).
- **Progress**: for an epic, a phase or the whole project, number of tasks, done tasks, points and done points.
- Uses, without changing them: the **Project** (spec 001), the **Plan** and its stages (spec 002), the **Proposals** (spec 005) and the **Tasks** (spec 003).

### Dependencies

- **002**: the structure of the methodology, architecture and roadmap stages.
- **003** (codigotpx): the board's tasks with their epic, points and column, and what counts as "done".
- **005**: the proposals give the rationale, the date and how each stage was approved.
- **008** (Mitchz01): which tasks a replan discards.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The three views of a project with 50 tasks are returned in less than 1 second.
- **SC-002**: Each epic's progress matches the board's done tasks at that moment in 100 % of cases.
- **SC-003**: 100 % of approved views state the agent, the rationale and how they were approved.
- **SC-004**: No view shows content from a proposal that isn't approved.
- **SC-005**: Every acceptance scenario is checked with automated tests, without a Gemini key.
