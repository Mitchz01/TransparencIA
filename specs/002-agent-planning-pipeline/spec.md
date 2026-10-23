# Feature Specification: 002 · Agent planning pipeline

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: sandredev  
**Use cases**: UC-03 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate the plan by stages (Priority: P1)

When the leader has created the project and the team and starts planning, a group of agents builds the work plan in six stages, always in this order: **analysis → methodology → architecture → roadmap → backlog → sprints**. Each stage is handled by an agent with a role (product analyst, agile coach, architect, product manager, product owner, scrum master). When it finishes, each stage leaves a **proposal** with what it decided and why. The next stage only starts once the previous one is approved.

**Why this priority**: it's the heart of the product and what the demo shows. Without it there's no board, roadmap or documents.

**Independent Test**: create a project with auto-approve on, start planning and verify that, without any other intervention, there are six approved proposals in order, each with its rationale.

**Acceptance Scenarios**:

1. **Scenario**: Planning starts
   - **Given** a newly created project with at least one member
   - **When** planning is started
   - **Then** the project moves to "planning", the analysis stage starts and the UI is told which agent is working

2. **Scenario**: Stage by stage
   - **Given** the analysis proposal is pending
   - **When** the leader approves it
   - **Then** the methodology stage starts, using the approved analysis as context

3. **Scenario**: Content adjusted by the leader
   - **Given** the leader adjusted the architecture proposal before approving it
   - **When** the roadmap stage runs
   - **Then** the roadmap uses the adjusted version, not the agent's original

4. **Scenario**: Full plan with auto-approve
   - **Given** a project with auto-approve on
   - **When** planning is started
   - **Then** the six stages run back to back, each proposal is recorded as automatically approved, and at the end the board is built (spec 003)

---

### User Story 2 - Methodology recommended or respected (Priority: P1)

If the leader didn't pick a methodology, the agile coach recommends the best fit (Scrum, Kanban, Scrumban, XP or Shape Up) based on team size, uncertainty and deadline, and explains why it discarded the others. If the leader already picked one, the agent respects it and explains how to adapt it to that team.

**Why this priority**: it's what sets the product apart from Jira and one of its principles ("The user is in charge").

**Independent Test**: run planning twice with the same project, once with "automatic" methodology and once with "Kanban", and compare the methodology proposals.

**Acceptance Scenarios**:

1. **Scenario**: Automatic recommendation
   - **Given** a project without a chosen methodology
   - **When** the methodology stage finishes
   - **Then** the proposal states the chosen methodology, the rationale, the ceremonies, the iteration length, the WIP limits and at least two discarded alternatives with their reason

2. **Scenario**: Methodology chosen by the leader
   - **Given** a project where the leader chose Kanban
   - **When** the methodology stage finishes
   - **Then** the proposal is Kanban and the rationale explains how it fits this team

---

### User Story 3 - A realistic plan for the team (Priority: P2)

The backlog and the sprints take into account who's on the team: each story is assigned to a member with a suitable role, and no iteration has more work than the team can do with its available hours.

**Why this priority**: a plan that can't be met hurts the product's credibility, but the demo works even if the estimate isn't perfect.

**Independent Test**: with a team of 3 people at 10 hours per week, verify that no iteration exceeds the estimated capacity and that every story has an owner from the team.

**Acceptance Scenarios**:

1. **Scenario**: Assignment by role
   - **Given** a team with a frontend developer and a backend developer
   - **When** the sprints stage finishes
   - **Then** each story is assigned by name to a real team member whose role fits the story

2. **Scenario**: No gaps
   - **Given** an approved backlog with 20 stories
   - **When** the sprints stage finishes
   - **Then** each story is in exactly one iteration and none is left out

---

### User Story 4 - Redo a rejected stage (Priority: P2)

If the leader rejects a proposal and gives a reason ("too ambitious for 4 weeks"), the agent redoes that stage taking the reason into account.

**Why this priority**: it completes the approval cycle, but the demo can be done just by approving.

**Independent Test**: reject the roadmap proposal with a reason and verify that the new proposal takes it into account and that the previous one stays in the history as rejected.

**Acceptance Scenarios**:

1. **Scenario**: Rejection with a reason
   - **Given** a pending roadmap proposal
   - **When** the leader rejects it with the reason "it's 4 weeks, not 8"
   - **Then** without any other action from the leader a new roadmap proposal is generated that fits in 4 weeks, and the previous one is recorded as rejected with its reason

2. **Scenario**: Rejection cap
   - **Given** the roadmap stage has already been rejected 3 times in a row
   - **When** the leader looks at the stage
   - **Then** the agent doesn't redo it by itself; the leader can retry it or adjust the last proposal and approve it

---

### User Story 5 - Recover from an agent error (Priority: P3)

If an agent fails (the service doesn't respond or returns something invalid), the leader sees which stage failed and can retry from that stage without losing what was already approved.

**Why this priority**: it avoids having to start over because of an error in the middle of the demo.

**Independent Test**: simulate a failure in the backlog stage, retry and verify that analysis, methodology, architecture and roadmap aren't generated again.

**Acceptance Scenarios**:

1. **Scenario**: Failure and retry
   - **Given** the backlog stage failed
   - **When** the leader retries
   - **Then** only the backlog stage runs again, with the same approved context

---

### Edge Cases

- What if the project description is very vague ("an app")? The analyst still proposes, and lists what needs defining under risks and scope.
- What if the agent assigns a story to someone who isn't on the team? The assignment is discarded and the story goes to another member with the same role (spec 003 rule).
- What if no member has the role a story asks for? The story stays unassigned and the analysis shows it as a team gap.
- What if the duration isn't enough for the scope? The roadmap fits the scope to the deadline and moves what doesn't fit to "out of scope", without stretching the deadline.
- What if planning is started on a project that's already planning? It's rejected: there's a single active run per project.
- What if the agent returns something with the wrong format? It's retried once; if it fails again, the stage ends in error (User Story 5).
- What if the leader changes the team while planning? It's allowed (spec 001): already approved stages don't change, the following ones use the new team, and a replan can happen later (spec 008).
- What if the leader wants to change the methodology while planning? Not allowed once planning has started, because the methodology stage already used it or is using it (spec 001, FR-009). To change it, reject the methodology proposal with that reason.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST run the six stages in a fixed order: analysis, methodology, architecture, roadmap, backlog and sprints.
- **FR-002**: Each stage MUST receive the project and team data and the final version (approved or adjusted) of the previous stages it needs. It never receives pending or rejected proposals.
- **FR-003**: Each stage MUST produce a result with a fixed, validated structure. Results that can't be displayed aren't accepted (constitution, principle 2).
- **FR-004**: Each result MUST become a proposal with its rationale visible to the leader.
- **FR-005**: The next stage MUST start only when the previous one is approved or adjusted.
- **FR-006**: With auto-approve on, each proposal MUST be approved by itself and recorded as automatically approved.
- **FR-007**: The system MUST report live when each stage starts, finishes or fails and which agent runs it (spec 005 shows it).
- **FR-008**: If the leader picked a methodology, the methodology stage MUST respect it. Otherwise, it MUST recommend one and justify at least two discarded alternatives.
- **FR-009**: Each backlog story MUST belong to an epic of the approved roadmap and be in exactly one iteration.
- **FR-010**: Assignments MUST refer to real team members; the work in each iteration MUST NOT exceed the team's estimated capacity based on their hours and seniority. That estimate uses the same rule as the board's overload warning (spec 003, FR-017), so a freshly generated plan never shows up as overloaded.
- **FR-011**: When a proposal is rejected with a reason, the system MUST redo that stage automatically, without the leader asking, using the reason and the rejected proposal as context. After 3 rejections in a row of the same stage, it stops redoing it by itself and waits for the leader to retry it or to write the version they want by adjusting the last proposal.
- **FR-012**: If a stage fails, the project MUST end up in error indicating the stage, and the leader MUST be able to retry it without redoing the approved stages.
- **FR-013**: There CAN only be one active planning run per project.
- **FR-014**: Results MUST be in the language of the project description.
- **FR-015**: The pipeline MUST be able to run without a connection to the AI service, with a sample plan, for development and demos (constitution, principle 6).
- **FR-016**: Planning MUST start with an explicit "start planning" request on a project in draft or error; creating the project doesn't start it (spec 001, FR-005). This request belongs to this spec, together with the FR-013 rule.

### Key Entities

- **Stage**: a step of the plan. It has a name, the agent (role) that runs it, which previous stages it uses as input and the structure of its result.
- **Stage proposal**: a stage's result waiting for a decision. It has content, rationale, status (pending, approved, adjusted, rejected), rejection reason and whether it was auto-approved. Its lifecycle is defined by spec 005.
- **Plan**: the final version of all the approved stages of a project. It's what the board (003), the views (004) and the documents (006) read.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With auto-approve, the full plan (all six stages) is generated in under 3 minutes for a project of 3 to 5 people.
- **SC-002**: The leader sees which agent is working less than 2 seconds after each stage starts.
- **SC-003**: 100% of the stories in the final plan are in an iteration and belong to an existing epic.
- **SC-004**: No iteration exceeds the team's estimated capacity.
- **SC-005**: After a failure, the retry doesn't regenerate any already approved stage.
- **SC-006**: Without a connection to the AI service, the full demo (project, plan and board) works end to end.
