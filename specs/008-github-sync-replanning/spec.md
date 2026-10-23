# Feature Specification: 008 · GitHub sync and replanning

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: Mitchz01  
**Reviewer**: sandredev  
**Use cases**: UC-12, UC-13 ([plan/use-cases.md](../../plan/use-cases.md))  

Depends on spec 007, which connects the repo and links each task to its issue. The 007 → 008 contract (which GitHub events arrive and how they identify the task) is agreed with codigotpx before approving.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The board moves forward with GitHub (Priority: P1)

As the team works on GitHub, tasks move on the board by themselves. Since **our board is the source of truth**, only progress comes in from GitHub, and it's applied without asking for approval:

| What happens on GitHub | Effect on the task |
|---|---|
| A PR that closes the issue is opened | In progress |
| The PR is ready for review | In review |
| The PR is merged | Done, with the checklist complete |
| The issue is closed (as completed) without a PR | Done |
| The issue is closed as "not planned" on GitHub | No change; it's shown in the activity feed so the leader decides |
| The issue is reopened | To do |

**Why this priority**: it's what keeps the plan "alive" without manual work, and it looks great in the demo.

**Independent Test**: with a connected repo and tasks published as issues, open and merge a PR that closes an issue, and verify that the task goes through "in progress" and "done" without touching the board.

**Acceptance Scenarios**:

1. **Scenario**: PR merged
   - **Given** a task "in review" linked to issue #12
   - **When** a PR that closes #12 is merged
   - **Then** the task moves to "done", its checklist is complete and the change shows up live on the board

2. **Scenario**: PR that closes several issues
   - **Given** two tasks linked to issues #12 and #13
   - **When** a PR that closes both is opened
   - **Then** both tasks move to "in progress"

3. **Scenario**: Event that doesn't come from GitHub
   - **Given** a change event that doesn't come from GitHub (it doesn't carry the project's signature)
   - **When** it reaches the system
   - **Then** it's rejected and the board doesn't change

---

### User Story 2 - Replan on demand (Priority: P1)

The leader asks for a replan with a reason ("a dev left", "a new client came in", "we're behind"). The agents look at the plan, the current team, the board and the real progress, and propose **concrete changes**: tasks that move between sprints, reassignments, new tasks and discarded tasks, each change with its rationale. The leader approves, adjusts or rejects it like any proposal. Done tasks are never touched.

**Why this priority**: it's the demo extra that shows the agents don't only build the plan, they also maintain it.

**Independent Test**: with an applied plan, remove a member from the team, ask for a replan and verify that the proposal reassigns their pending tasks and that, when approved, the board changes in a single step.

**Acceptance Scenarios**:

1. **Scenario**: A member leaves
   - **Given** an applied plan where Ana has 4 pending tasks and 2 done
   - **When** the leader removes Ana from the team and asks for a replan with "Ana left"
   - **Then** the proposal reassigns the 4 pending tasks to members with a suitable role, moves to another sprint what doesn't fit the capacity, and doesn't touch the 2 done tasks

2. **Scenario**: Approving applies everything together
   - **Given** a replan proposal with 6 changes
   - **When** the leader approves it
   - **Then** the 6 changes are applied together; if one can't be applied, none is

3. **Scenario**: Adjust before approving
   - **Given** a replan proposal
   - **When** the leader removes one of the changes and approves
   - **Then** all the changes except that one are applied

---

### User Story 3 - Objectives that close by themselves (Priority: P2)

Each sprint has an objective: its goal and its tasks (spec 003 creates it when building the board). When all the tasks of an objective are done, the objective is marked as met without anyone closing it by hand.

**Why this priority**: it gives a sense of progress, but the board already shows progress task by task.

**Independent Test**: complete the last pending task of an objective, from GitHub or by moving it by hand, and verify that the objective is met.

**Acceptance Scenarios**:

1. **Scenario**: Last task done
   - **Given** an objective with 3 tasks, 2 of them done
   - **When** the third one moves to "done"
   - **Then** the objective is met and the live activity feed shows it

---

### User Story 4 - Detect drift (Priority: P3)

The system detects when the plan drifted from reality (a sprint ended with pending tasks, or the team changed with a plan already applied) and proposes a replan by itself, which the leader approves, adjusts or rejects.

**Why this priority**: it's automation on top of User Story 2, which already covers the on-demand case.

**Independent Test**: close a sprint with 3 unfinished tasks and verify that a replan proposal mentioning those 3 tasks shows up by itself.

**Acceptance Scenarios**:

1. **Scenario**: Sprint with pending work
   - **Given** a sprint that reached its end date with 3 unfinished tasks
   - **When** the sprint is closed
   - **Then** a replan proposal appears whose reason lists the 3 pending tasks

2. **Scenario**: Team change
   - **Given** an applied plan
   - **When** the leader adds or removes a member, or changes someone's role, seniority or hours
   - **Then** a replan proposal appears whose reason says who joined, left or changed

---

### Edge Cases

- What if GitHub sends the same event twice? The effect is applied only once.
- What if an event arrives from a repo that isn't connected to any project, or from an issue without a linked task? It's ignored without an error.
- What if a task is already "done" (moved by hand) and a PR-opened event arrives? It doesn't go back: GitHub events never move a task out of "done", unless the issue is reopened.
- What if a replan is requested (or detected) while another one is pending? A new one is generated that combines the reasons of both and replaces the previous one, which stays discarded in the history.
- What if the board changed between generating the proposal and approving it? Changes that refer to tasks no longer in the expected state are discarded, and the rest is applied; the leader sees which ones were discarded.
- What if the replan adds tasks and the project has a connected repo? When it's approved, publishing them as issues is proposed (spec 007, FR-006).
- What if the replan discards a task that already has an issue? The issue is closed as "not planned" (spec 007, FR-022), and that closing doesn't mark it as done.
- What about events for changes the system itself made on GitHub (creating, editing or closing issues)? They're ignored (FR-015).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST receive the PR and issue events of the connected repo and apply the state changes in the User Story 1 table, without a proposal.
- **FR-002**: The system MUST verify that each event really comes from GitHub for that project, and reject the ones that don't.
- **FR-003**: Processing the same event more than once MUST NOT change the result.
- **FR-004**: GitHub events MUST NOT move a task out of "done", except reopening the issue.
- **FR-005**: When a PR is merged, the linked tasks MUST end up with their checklist complete.
- **FR-006**: Every change that comes from GitHub MUST show up live on the board and in the project activity (spec 005).
- **FR-007**: An objective MUST be marked as met when all its tasks are done, regardless of whether they reached "done" from GitHub or by hand.
- **FR-008**: The leader MUST be able to ask for a replan with a free-text reason.
- **FR-009**: The replan MUST arrive as a proposal with a list of changes (move between sprints, reassign, add, discard), each with its rationale, based on the approved plan, the current team, the board and the real progress.
- **FR-010**: When a sprint ends with pending work or the team changes with an applied plan, the system MUST automatically propose a replan whose reason describes the drift (which tasks were left pending, or what changed in the team). The team changes that trigger it are joins, leaves and changes of role, seniority or hours, because they change the capacity or who can be assigned work; renaming a member or changing their skills doesn't trigger it. The system reacts to spec 001's "team changed" event (FR-010).
- **FR-011**: No replan MUST modify done tasks.
- **FR-012**: When a replan is approved, its changes MUST be applied all together or not at all, except the ones discarded by the changed-board edge case, which are reported.
- **FR-013**: The leader MUST be able to remove individual changes from the proposal before approving it.
- **FR-014**: There CAN only be one pending replan per project.
- **FR-015**: GitHub events caused by the system's own actions MUST NOT be applied to the board again (rule shared with spec 007, FR-023).
- **FR-016**: Automatically proposed replans (FR-010) MUST wait for the leader's decision even if the project has auto-approve on, because they reorganize work in progress without anyone asking. The ones the leader asks for (FR-008) follow the project's auto-approve rule.

### Key Entities

- **GitHub event**: a change to a PR or an issue of the connected repo. It says which issues it affects and what happened.
- **Task ↔ issue link**: relates each task to its issue. Spec 007 creates it; this spec only reads it.
- **Objective**: a sprint's goal with its tasks (spec 003 creates it); it's met when all of them are done.
- **Replan proposal**: the reason, the list of changes with their rationale and its status. Its lifecycle is defined by spec 005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A change on GitHub shows up on the board in under 10 seconds.
- **SC-002**: Repeated GitHub events never produce duplicate changes or tasks in a wrong state.
- **SC-003**: The replan proposal arrives less than 60 seconds after it's requested.
- **SC-004**: 0% of done tasks change because of a replan.
- **SC-005**: After approving a replan caused by a member leaving, 100% of their pending tasks are reassigned or discarded with a rationale.
