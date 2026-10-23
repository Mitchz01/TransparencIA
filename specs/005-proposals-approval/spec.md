# Feature Specification: 005 · Proposals, approval and live activity

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: sandredev  
**Reviewer**: codigotpx  
**Use cases**: UC-04, UC-14 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: the service (backend) that lists the agents' proposals, lets the leader approve, adjust or reject them, hands each decision to the spec that applies it, sets the auto-approve rule, and publishes the project's activity live and as a history.
- **Doesn't include**: the screens (frontend). The stories are tested directly against the service; who builds the screens is still to be decided in [specs/README.md](../README.md).
- **Doesn't include**: what each agent produces or what applying each kind of proposal does in detail. That belongs to the spec that owns each kind (table below). This spec defines the **lifecycle shared by all of them** and when they're applied.

## Kinds of proposal

| Kind | Who creates it | What approving it does | Owner spec |
|---|---|---|---|
| Plan stage | Planning agents | Stores the stage in the plan and starts the next one; after the sprints stage, the board is built | 002, 003 |
| Document | Writer agent | Creates the document or a new version | 006 |
| GitHub action | GitHub agents and reviewer | Writes to GitHub (issues, review requests, comments) | 007 |
| Replan | Agents, on request or on drift | Applies the changes to the board, all together | 008 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what the agents proposed and why (Priority: P1)

The leader asks for the proposals of their project and sees, for each one, which agent made it, its kind, what it proposes, why (the rationale) and its status. They can ask for the pending ones only or the full history.

**Why this priority**: there's no decision without seeing the proposal. It's the base of "Agent transparency" and "Nothing is applied without approval" (constitution, principles 3 and 8).

**Independent Test**: load three proposals of a project (one pending, one approved, one rejected); asking for pending ones returns one, the history returns all three, newest first, and each one has agent, kind, content, rationale and status.

**Acceptance Scenarios**:

1. **Scenario**: Pending proposals
   - **Given** a project with the methodology proposal pending and the analysis one approved
   - **When** the leader asks for pending proposals
   - **Then** they get only the methodology one, with the agent "Agile coach", its content and its rationale

2. **Scenario**: History
   - **Given** a project where the roadmap proposal was rejected once and then approved
   - **When** the leader asks for the history
   - **Then** they see both roadmap proposals, newest first: the approved one, then the rejected one with its reason

3. **Scenario**: Unknown proposal
   - **Given** no proposal exists with that id
   - **When** it's requested
   - **Then** the answer is "not found"

---

### User Story 2 - Approve or adjust a proposal (Priority: P1)

The leader approves a proposal as it came, or **adjusts** it: changes what they want (for example, removes a task from the list of issues to publish, or shortens a phase) and approves that version. The decision is saved right away and the proposal is then applied by the spec that owns its kind (the next stage, the board, the document or the GitHub action). What gets applied, and what the next steps see, is always the final version: the adjusted one if there was an adjustment, the original otherwise.

**Why this priority**: it's the step that unlocks the whole demo. Without approving, the plan doesn't move and the board never appears.

**Independent Test**: approve a pending stage proposal; it's approved, and the plan stage's owner is asked to apply it. Then adjust another one changing a field; the adjusted version is what gets applied.

**Acceptance Scenarios**:

1. **Scenario**: Approve as is
   - **Given** the analysis proposal pending
   - **When** the leader approves it
   - **Then** it's approved with its date, and spec 002 stores it in the plan and starts the methodology stage

2. **Scenario**: Adjust
   - **Given** the roadmap proposal pending, with a phase from week 1 to week 4
   - **When** the leader adjusts it so the phase goes from week 1 to week 3
   - **Then** it's adjusted, both versions are kept (the agent's and the leader's) and the plan uses the leader's

3. **Scenario**: Adjustment with an invalid format
   - **Given** the methodology proposal pending
   - **When** the leader adjusts it with a methodology that doesn't exist, or removes a required field
   - **Then** nothing changes, the proposal stays pending and the answer says which field is wrong

4. **Scenario**: Approve the last plan stage
   - **Given** the sprints proposal pending
   - **When** the leader approves it
   - **Then** the board is built (spec 003) and the project becomes "ready"

5. **Scenario**: Already resolved
   - **Given** a proposal that's already approved
   - **When** someone tries to approve, adjust or reject it again
   - **Then** the answer says it's already resolved and nothing changes

6. **Scenario**: Applying fails
   - **Given** a pending proposal whose application fails (for example, an internal error while building the board)
   - **When** the leader approves it
   - **Then** the decision stays saved, the activity feed shows that it couldn't be applied and why, and the leader can retry applying it

---

### User Story 3 - Follow the activity live (Priority: P1)

While someone has a project open, they get what happens in it live, without reloading: which agent started or finished, which proposal appeared or was resolved, what changed on the board or in the team, and what came from GitHub. Each notice says what happened, when, who did it (an agent, a person, GitHub or the system) and what it refers to (proposal, task, document).

**Why this priority**: it's what makes the agents' work visible in the demo (constitution, principle 3), and specs 002, 003, 006, 007 and 008 all count on it.

**Independent Test**: open the live connection of a project, create and approve a proposal, and check that two notices arrive in order ("proposal created" and "proposal resolved") and that no notice from another project arrives.

**Acceptance Scenarios**:

1. **Scenario**: Agent working
   - **Given** someone is following the project's activity
   - **When** the architecture stage starts
   - **Then** they get a notice that the "Software architect" started working, in less than 2 seconds

2. **Scenario**: Only their project
   - **Given** two projects with activity at the same time
   - **When** someone follows the first one
   - **Then** they get no notice from the second one

3. **Scenario**: The connection drops
   - **Given** someone following the activity loses the connection, and two proposals are approved meanwhile
   - **When** they reconnect, saying which was the last notice they got
   - **Then** they get the two notices they missed, in order, and then keep following live

---

### User Story 4 - Reject with a reason (Priority: P2)

The leader rejects a proposal and says why ("it's 4 weeks, not 8"). The reason is saved with the proposal and handed to the spec that owns its kind: for a plan stage or a document, the agent redoes it using the reason, up to the limit of 3 rejections in a row (specs 002 and 006); for a GitHub action or a replan, nothing else happens. Once a stage reaches that limit, the leader can **write the version they want** by adjusting the last rejected proposal and approving it.

**Why this priority**: it closes the decision loop, but the demo works by approving only.

**Independent Test**: reject a roadmap proposal with a reason; it's rejected with the reason and spec 002 is asked to handle it. With three rejections in a row, the last rejected one can be adjusted and approved; with fewer, it can't.

**Acceptance Scenarios**:

1. **Scenario**: Reject with a reason
   - **Given** the roadmap proposal pending
   - **When** the leader rejects it with "it's 4 weeks, not 8"
   - **Then** it's rejected with that reason and spec 002 redoes the roadmap with the reason as context

2. **Scenario**: Empty reason
   - **Given** a pending proposal
   - **When** the leader rejects it with no reason, or a reason made only of spaces
   - **Then** it isn't rejected and the answer says the reason is required

3. **Scenario**: The leader writes their own version
   - **Given** the roadmap stage with 3 rejections in a row
   - **When** the leader adjusts the last rejected proposal with their own version
   - **Then** that version is approved as adjusted and the plan continues with the backlog stage

4. **Scenario**: Adjusting a rejected proposal before the limit
   - **Given** the roadmap stage with 1 rejection
   - **When** the leader tries to adjust the rejected proposal
   - **Then** nothing changes and the answer says it's already resolved

---

### User Story 5 - Auto-approve (Priority: P2)

If the project has auto-approve on, every new proposal is approved as soon as it's created and applied as if the leader had approved it. It's still recorded with its content, its rationale and the "auto-approved" mark, and the activity feed shows it. Proposals the system creates on its own, without anyone asking (for example, replans on drift, spec 008 FR-016), **always wait for the leader**, even with auto-approve on.

**Why this priority**: it lets the demo run end to end without clicks, but the manual flow already covers the base case.

**Independent Test**: with auto-approve on, create a stage proposal; it ends approved automatically and applied, with no action. Create a proposal the system raised on its own; it stays pending.

**Acceptance Scenarios**:

1. **Scenario**: Automatic approval
   - **Given** a project with auto-approve on
   - **When** the agent creates the analysis proposal
   - **Then** it's approved automatically and applied, the next stage starts, and the activity feed shows it approved itself

2. **Scenario**: A proposal that waits for the leader
   - **Given** a project with auto-approve on
   - **When** the system proposes a replan on its own because of drift
   - **Then** the proposal stays pending until the leader decides

3. **Scenario**: Turning auto-approve on with pending proposals
   - **Given** a project with a pending proposal and auto-approve off
   - **When** the leader turns auto-approve on (spec 001)
   - **Then** the pending proposal stays pending; auto-approve only applies to new proposals

4. **Scenario**: Review later
   - **Given** an auto-approved proposal
   - **When** the leader looks at it
   - **Then** they see its content, its rationale and that it was approved automatically

---

### User Story 6 - Activity history (Priority: P2)

Besides following it live, the leader can ask for a project's activity and see earlier notices, newest first, even if they weren't connected when they happened. This way they can know, for example, which proposal authorized a GitHub action (spec 007, FR-020).

**Why this priority**: it covers whoever arrives late and keeps a record of what the agents did, but the demo works with the live feed.

**Independent Test**: produce five notices with nobody connected; the history returns all five, newest first, and they can be requested two at a time.

**Acceptance Scenarios**:

1. **Scenario**: See what happened
   - **Given** a project where three proposals were approved while nobody was connected
   - **When** the leader asks for the activity
   - **Then** they see the three notices with what happened, when and who did it

2. **Scenario**: In pages
   - **Given** a project with 120 notices
   - **When** the leader asks for the activity
   - **Then** they get the 50 newest and can ask for the previous ones

---

### User Story 7 - Approve several at once (Priority: P3)

The leader picks several pending proposals of their project and approves them in one go (for example, the specs of each epic, spec 006). Each one is approved and applied separately: if one fails, the others go on, and the answer says which were approved and which weren't, with the reason.

**Why this priority**: it saves clicks when there are many proposals, but approving one by one is enough.

**Independent Test**: ask to approve three pending proposals and one already resolved; the answer says three were approved and one couldn't be because it was already resolved.

**Acceptance Scenarios**:

1. **Scenario**: Bulk approval
   - **Given** five pending per-epic spec proposals
   - **When** the leader approves them together
   - **Then** all five are approved and the five documents are created

2. **Scenario**: One can't be approved
   - **Given** three pending proposals and one already approved
   - **When** the leader asks to approve all four
   - **Then** the three pending ones are approved and the answer says the fourth was already resolved

3. **Scenario**: A proposal from another project
   - **Given** one of the chosen proposals belongs to another project
   - **When** the leader asks to approve them together
   - **Then** that one isn't approved and the answer says so; the others are

---

### Edge Cases

- **Two decisions at the same time**: if two people approve (or one approves and another rejects) the same proposal at once, the first one wins; the second gets "already resolved".
- **Replaced proposal**: when a pending proposal is replaced by a newer one on the same subject (for example, a new replan that merges the reasons of the previous one, spec 008), the old one becomes **discarded**: it's never applied, can't be approved and stays in the history. The system discards it, not the leader.
- **Partial adjustment**: removing items from a list (tasks to publish, changes of a replan) is an adjustment like any other. Which items can be removed and how the rest is applied is defined by the owner spec (007, FR-007; 008, FR-012 and FR-013).
- **Adjusting a rejected proposal**: only allowed on the last rejected proposal of a plan stage or document that reached 3 rejections in a row. Any other rejected proposal can't be touched.
- **Retrying an application**: only an approved or adjusted proposal whose application failed can be retried. Retrying one that was applied fine does nothing and says so.
- **GitHub actions that take long**: approving a GitHub action authorizes it even if GitHub doesn't answer at that moment; retries are handled by spec 007.
- **Nobody connected**: notices are saved in the history anyway, even if nobody is following live.
- **Very late reconnection**: if whoever reconnects missed more notices than are kept for resending (more than 200), they get a notice telling them to reload the full project state.
- **Who decides**: until there are users (constitution, principle 5), anyone with access to the project can decide on a proposal. The history records whether a person decided it or it approved itself.

## Requirements *(mandatory)*

### Functional Requirements

**Proposals (UC-04)**

- **FR-001**: Every agent decision MUST be saved as a proposal before it's applied, with project, kind, subject (stage or action), agent, content, rationale, status and creation date (constitution, principle 8).
- **FR-002**: A proposal MUST be in one of these statuses: pending, approved, adjusted, rejected or discarded. Only a pending one can move to another status, with the single exception of the edge case "adjusting a rejected proposal".
- **FR-003**: The system MUST list a project's proposals, all of them or filtered by status, newest first, and return one by its id.
- **FR-004**: Approving or adjusting MUST save the decision with its date and then hand the proposal to the owner of its kind to apply it (table "Kinds of proposal"). If applying fails, the decision stays saved, the activity feed MUST say so with the reason, and the leader MUST be able to retry the application.
- **FR-005**: Adjusting MUST validate the leader's version with the same structure the kind requires (constitution, principle 2), keep both versions and apply the leader's. If the version isn't valid, nothing MUST change and the answer MUST say which field fails.
- **FR-006**: Later steps (other stages, the board, the documents) MUST always use the final version of a proposal: the adjusted one if there was an adjustment, the original otherwise.
- **FR-007**: Rejecting MUST require a non-empty reason, save it with the proposal and hand it to the owner of its kind. Redoing the stage or document, and the limit of 3 rejections in a row, belong to specs 002 (FR-011) and 006.
- **FR-008**: A resolved proposal MUST NOT be resolvable again; the attempt MUST say it's already resolved.
- **FR-009**: The system MUST allow approving several pending proposals of the same project in one request, each one separately, and report the result of each.
- **FR-010**: The system MUST allow the owner spec of a kind to discard a pending proposal when another one replaces it.

**Auto-approve**

- **FR-011**: If the project has auto-approve on, every new proposal MUST be approved and applied as soon as it's created, and be marked as auto-approved; except the ones the system creates on its own without anyone asking, which stay pending (spec 008, FR-016).
- **FR-012**: Turning auto-approve on MUST NOT approve the proposals that were already pending.

**Activity (UC-14)**

- **FR-013**: Everything that happens in a project and that another spec asks to show MUST be published as an activity notice, with kind, time, who did it (agent, person, GitHub or system), a readable summary and what it refers to (proposal, task, document or member).
- **FR-014**: The system MUST allow following a project's activity live, getting only that project's notices, in the order they happened.
- **FR-015**: Every notice MUST have an order number. Whoever reconnects saying the last one they got MUST receive the ones they missed, in order, up to the last 200; if they missed more, they MUST get a notice to reload the full state.
- **FR-016**: Every notice MUST be saved and be available as the project's history, newest first, 50 at a time.
- **FR-017**: The system MUST work without a Gemini key or a GitHub token (mock mode, constitution principle 6).

### Activity notices (contract with 001, 002, 003, 006, 007 and 008)

| Notice | Published by | When |
|---|---|---|
| Agent started / finished / failed (`AgentStarted`, `AgentFinished`, `PlanFailed`) | 002, 006 | When a stage or a document starts, finishes or fails, with the agent and what it's doing |
| Stage waiting for the leader (`StageNeedsLeader`) | 002 | On the third rejection in a row of a stage |
| Plan completed (`PlanCompleted`) | 002 | When the last stage is approved |
| Proposal created (`ProposalCreated`) | 005 | When a new proposal is saved |
| Proposal resolved (`ProposalResolved`) | 005 | When it's approved (by hand or by itself), adjusted, rejected or discarded; includes the reason if rejected |
| Proposal couldn't be applied (`ProposalApplyFailed`) | 005 | When applying an approved proposal fails, with the reason |
| Team changed (`TeamChanged`) | 001 | When the members change (001, FR-010) |
| Plan applied to the board (`PlanApplied`) | 003 | When the board is built |
| Task changed (`TaskStatusChanged`, `TaskUpdated`) | 003 | When a task is moved, edited or its checklist changes |
| Documents generated (`DocumentsGenerated`) | 006 | When the documents of a plan are proposed |
| Issues published (`IssuesPublished`) | 007 | When writing to GitHub, with the proposal that authorized it |
| Progress from GitHub, ignored GitHub event (`GithubEventIgnored`) | 008 | When a PR or issue changes a task, or an event is ignored |
| Objective met, sprint closed, replan applied (`ObjectiveClosed`, `SprintClosed`, `ReplanApplied`) | 008 | When they happen |

Each owner spec defines the details of its notices; this spec defines the common data they all carry (FR-013) and how they're received.

### Key Entities *(include if feature involves data)*

- **Proposal**: an agent decision waiting for, or with, the leader's decision. Project, kind, subject, agent, original content, adjusted content (if any), rationale, status, rejection reason, whether it approved itself, origin (asked by someone, or raised by the system on its own), creation and resolution dates, and whether its application failed.
- **Activity notice**: something that happened in a project. Order number, kind, time, who did it, summary and a reference to what it affects.

### Contracts with other specs

- **002 → 005** (Mitchz01): spec 002 creates the stage proposals and auto-approves them following this spec's rule (FR-011). After approving, adjusting or rejecting a `plan_stage` proposal, this spec calls spec 002's "proposal resolved" step, which stores the stage, starts the next one or redoes it. The rule that says whether a stage reached 3 rejections in a row is shared: this spec uses it to allow "adjusting a rejected proposal".
- **005 → 003** (codigotpx): spec 003 builds the board when spec 002 reports the plan completed; this spec doesn't call 003 directly.
- **005 → 006, 007, 008**: after approving or adjusting, this spec calls the step that applies the kind: create or version the document (006), publish issues or apply a review depending on the action (007), apply the replan (008). Each owner defines the structure of its content and, for 008, which proposals are raised by the system on its own.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Approving, adjusting or rejecting a proposal answers in less than 1 second, even if the next agent takes minutes.
- **SC-002**: An activity notice reaches whoever follows it in less than 2 seconds after it happens.
- **SC-003**: 0 % of proposals are applied without being approved, adjusted or auto-approved.
- **SC-004**: 100 % of resolved proposals keep in the history their content, their rationale, who or how it was decided and, if rejected, the reason.
- **SC-005**: After reconnecting, whoever follows the activity neither misses nor repeats any of the last 200 notices.
- **SC-006**: With auto-approve and no Gemini key, the six-stage plan is approved and reaches the board without any action.
