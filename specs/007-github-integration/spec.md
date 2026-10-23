# Feature Specification: 007 · GitHub integration

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: codigotpx  
**Reviewer**: Mitchz01  
**Use cases**: UC-09, UC-10, UC-11 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

The leader connects the project's GitHub repository. From then on, board tasks are published as issues and, when someone opens a PR that resolves a task, the agents propose who should review it and leave a first review.

Rules that come from the product context:
- **One repo per project.**
- **Our board is the source of truth**: issues mirror the tasks.
- **Everything written to GitHub goes through a proposal**, because third parties see it. It's approved by hand or with auto-approve (spec 005).

### User Story 1 - Connect the project's repo (Priority: P1)

The leader goes to Integrations, types the repo (`owner/name`) and connects it. The system checks it has access and shows the connected repo.

**Why this priority**: without a connected repo, nothing else in the integration works.

**Independent Test**: connect a test repo the system has access to and verify that the project shows it as connected. Also try a repo that doesn't exist.

**Acceptance Scenarios**:

1. **Scenario**: Successful connection
   - **Given** a project without a repo and a repo the system has access to
   - **When** the leader enters `owner/name` and confirms
   - **Then** the project shows the repo as connected, with a link to GitHub

2. **Scenario**: Repo missing or without access
   - **Given** a repo that doesn't exist or that the system can't access
   - **When** the leader tries to connect it
   - **Then** a clear message is shown ("doesn't exist" or "no permissions") and the project stays without a repo

3. **Scenario**: Switch repos
   - **Given** a project that already has a connected repo
   - **When** the leader connects another one
   - **Then** they're warned that it replaces the previous one and, if they confirm, only the new one stays connected

4. **Scenario**: Disconnect
   - **Given** a project with a connected repo
   - **When** the leader disconnects it
   - **Then** the project stops receiving and sending changes to GitHub; cards keep the links to the issues already created

---

### User Story 2 - Publish tasks as issues (Priority: P1)

With the board built and the repo connected, the system proposes publishing the tasks as issues. The leader sees the list, approves it (or removes some) and the issues are created. Each card shows its issue number and link.

**Why this priority**: it's the bridge between the plan and the team's real work on GitHub, and the basis for syncing progress (spec 008).

**Independent Test**: with a 5-task board and a test repo, approve the proposal and verify that 5 issues are created and that each card shows its link.

**Acceptance Scenarios**:

1. **Scenario**: Publishing proposal
   - **Given** a project with a built board and a connected repo
   - **When** the repo is connected or the board is built (whichever happens last)
   - **Then** a "Publish N tasks as issues" proposal appears with the list of tasks

2. **Scenario**: Approve publishing
   - **Given** the pending publishing proposal
   - **When** the leader approves it
   - **Then** one issue per task is created, with title, description, acceptance criteria, the checklist as a GitHub task list, type and priority labels, and the assignee if they have a GitHub username; each card shows "#number" with a link

3. **Scenario**: Adjust before approving
   - **Given** the pending publishing proposal
   - **When** the leader removes two tasks from the list and approves
   - **Then** only the remaining tasks are published; the others can be published later

4. **Scenario**: New tasks
   - **Given** tasks already published and new tasks without an issue
   - **When** a replan that adds tasks is approved (spec 008), or the leader asks to "Publish pending tasks"
   - **Then** a proposal appears that includes only the tasks without an issue; the same task is never published twice

5. **Scenario**: Partial failure
   - **Given** GitHub rejects the creation of some issues
   - **When** publishing finishes
   - **Then** the created issues stay linked and the leader sees which ones failed and can retry them

6. **Scenario**: Discarded task
   - **Given** a task published as issue #12
   - **When** a replan that discards it is approved, or the leader deletes it
   - **Then** issue #12 is closed as "not planned", with a comment explaining the reason, and that doesn't mark any task as done

---

### User Story 3 - Register each member's GitHub username (Priority: P2)

The leader enters each team member's GitHub username. That way issues are assigned to the right person and reviewers can be suggested.

**Why this priority**: without it, issues are still published, but unassigned and without suggested reviewers.

**Independent Test**: enter a member's GitHub username, publish a task assigned to them and verify that the issue is assigned to that user.

**Acceptance Scenarios**:

1. **Scenario**: Valid username
   - **Given** a member without a GitHub username
   - **When** the leader enters a username that exists and has access to the repo
   - **Then** the member is linked and their next issues are assigned to that user

2. **Scenario**: Username without repo access
   - **Given** a GitHub user that exists but has no access to the repo
   - **When** the leader enters it
   - **Then** it's saved with a warning that issues and reviews can't be assigned to them until they have access

---

### User Story 4 - Assisted code review of a PR (Priority: P2)

When someone opens a PR that resolves a project task, the system proposes who should review it and prepares a first review written by an agent, which compares the change against the task's acceptance criteria. If the leader approves, the reviews are requested and the comment is posted on the PR.

**Why this priority**: it's the "automation with agents" part that shows the most value, but it depends on issues and GitHub usernames already existing.

**Independent Test**: open a PR in the test repo that says "Closes #N" for a project issue, and verify that the proposal with reviewers and a comment shows up; approve it and see the review request and the comment on GitHub.

**Acceptance Scenarios**:

1. **Scenario**: PR linked to a task
   - **Given** a task published as issue #12
   - **When** a member opens a PR that says "Closes #12"
   - **Then** a proposal appears with suggested reviewers and a review comment from the agent, with its rationale

2. **Scenario**: Choosing reviewers
   - **Given** a PR from a Backend member in a team with two other Backend members
   - **When** the system suggests reviewers
   - **Then** it suggests the Backend member with the fewest pending reviews, never the PR author

3. **Scenario**: Approve the review
   - **Given** the pending review proposal
   - **When** the leader approves it (or changes the reviewers and approves)
   - **Then** reviews are requested from the chosen reviewers and the comment is posted on the PR, marked as generated by an agent

4. **Scenario**: PR without a task
   - **Given** a PR that doesn't reference any project issue
   - **When** it's opened
   - **Then** the system doesn't propose anything

---

### Edge Cases

- What if the repo is switched with issues already published? Cards keep the links to the previous repo; tasks without an issue are published in the new one.
- What if a published task is edited (title, description, criteria, checklist, assignee)? The issue updates by itself, without a proposal: publishing it was already approved, the issue mirrors the task, and the change was made by a person, not an agent. It's recorded in the activity feed.
- What if someone edits the issue directly on GitHub? The task isn't touched; only state changes come in from GitHub (spec 008).
- What if the issue is deleted on GitHub? The card shows the link as broken and the task can be published again.
- What if the PR author is the only member with that role? The member with a GitHub username and the fewest pending reviews is suggested, even from another role, with the reason. If nobody else has a GitHub username, the proposal goes out without reviewers, only with the agent's comment, and the leader can add them.
- What about the events GitHub sends for changes the system itself made (creating, editing or closing an issue)? They're ignored: they don't come back in as progress (spec 008). For example, closing the issue of a discarded task never marks it as done.
- What if the PR is too big to review entirely? The agent reviews what it can and says so explicitly in the comment.
- What if GitHub doesn't respond or rate-limits the calls? The action stays pending and is retried; the leader sees that it's delayed.
- What if several PRs are opened for the same task? A review is proposed for each one.
- Does the system also open PRs? No. The team opens PRs with their code; the system requests reviews and comments. Creating branches or draft PRs per task is out of scope for this spec (it can be added later without changing the rest).

## Requirements *(mandatory)*

### Functional Requirements

**Connection (UC-09)**

- **FR-001**: The leader MUST be able to connect a single GitHub repo per project, entering `owner/name`.
- **FR-002**: The system MUST verify that the repo exists and that it has permissions to create issues and comment before treating it as connected, and show the reason if it fails.
- **FR-003**: The system MUST subscribe to the repo's changes (PRs and issues) when connecting it, and unsubscribe when disconnecting or replacing it.
- **FR-004**: The leader MUST be able to enter a GitHub token for their project when connecting it (constitution, principle 5). If they don't, the system uses the installation's token if there is one (useful for the demo). The token is never shown again in the UI; it can only be replaced or deleted.
- **FR-005**: With no token at all (neither the project's nor the installation's), the system MUST work in test mode: it records the actions instead of sending them to GitHub, so the demo can run (constitution, principle 6).

**Publishing issues (UC-10)**

- **FR-006**: With a board and a repo, the system MUST propose publishing all the tasks that don't have an issue yet at three moments: the first time it has both, when a replan that adds tasks is approved (spec 008) and when the leader asks for it. Creating a task by hand doesn't generate a proposal by itself, to avoid flooding the leader with proposals.
- **FR-007**: The leader MUST be able to remove tasks from the proposal before approving it.
- **FR-008**: When approved, the system MUST create one issue per task with title, description, acceptance criteria, the checklist as a task list, type and priority labels, and the assignee if they have a GitHub username.
- **FR-009**: Each published card MUST show its issue number and link.
- **FR-010**: The system MUST guarantee that a task has at most one issue.
- **FR-011**: On partial failures, the system MUST keep the created issues, show which ones failed and allow retrying them.

**GitHub usernames**

- **FR-012**: The leader MUST be able to enter and edit each member's GitHub username, and the system MUST warn if that user has no access to the repo.

**Assisted code review (UC-11)**

- **FR-013**: When a PR that references a project issue is opened, the system MUST generate a review proposal with suggested reviewers and a comment from the reviewer agent.
- **FR-014**: The system MUST suggest reviewers with the right role for the task and the fewest pending reviews, excluding the PR author.
- **FR-015**: The agent's comment MUST evaluate the change against the task's acceptance criteria, justify each remark and say if it didn't review the whole PR.
- **FR-016**: The leader MUST be able to change the reviewers or edit the comment before approving.
- **FR-017**: When approved, the system MUST request the reviews and post the comment on the PR, marked as generated by an agent.
- **FR-018**: The system MUST ignore PRs that don't reference project issues.

**Cross-cutting**

- **FR-019**: Every new write to GitHub (creating issues, requesting reviews, commenting) MUST go through an approved proposal, manually or through auto-approve (spec 005).
- **FR-020**: Every action taken on GitHub MUST be recorded in the project activity: what, when and which proposal authorized it.
- **FR-021**: When a published task is edited, the system MUST update its issue without a proposal (title, description, criteria, checklist and assignee), because publishing was already approved and the change was made by a person (or an approved replan).
- **FR-022**: When a published task is discarded in an approved replan (spec 008) or deleted, the system MUST close its issue as "not planned", with a comment explaining the reason.
- **FR-023**: The system MUST recognize the changes it made itself on GitHub, so they don't come back in as team progress (spec 008, FR-015).

### Key Entities *(include if feature involves data)*

- **Connected repository**: the project's `owner/name` repo. One per project, with its connection status.
- **Task ↔ issue link**: links a task to its issue (number, link and state). A task has at most one issue.
- **Task ↔ PR link**: links a task to the PRs that resolve it.
- **GitHub action proposal**: a proposal (spec 005) that describes what's going to be written to GitHub: issues to create, or the reviewers and comment of a review.
- **Suggested review**: proposed reviewers with their rationale and the agent's comment for a PR.
- **Member's GitHub username**: extra member data (spec 001) to assign issues and request reviews.

### Dependencies

- **003**: the published tasks come from the board.
- **005**: every write to GitHub is a proposal with approval.
- **001**: the GitHub username is member data; it's entered from Integrations (FR-012), not when creating the team.
- **007 → 008**: which GitHub events arrive and how they move tasks is defined by 008; this spec only uses the "PR opened" event for the review (contract in [specs/README.md](../README.md)). Both specs share one rule: changes the system itself made on GitHub don't come back as progress (FR-023 here, FR-015 in 008).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The leader connects the repo in under 1 minute, without leaving the tool.
- **SC-002**: 100% of the tasks approved for publishing end up with exactly one linked issue, or with a visible error that can be retried.
- **SC-003**: The review proposal appears less than 2 minutes after a linked PR is opened.
- **SC-004**: In at least 80% of the review proposals, the leader approves the suggested reviewers without changing them.
- **SC-005**: No new issue, review request or comment reaches GitHub without an approved proposal backing it.
- **SC-006**: A change to a published task shows up in its issue in under 1 minute.
