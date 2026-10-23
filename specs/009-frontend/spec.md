# Feature Specification: 009 · Frontend

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: the screens of UC-01 to UC-14 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: every screen of the product and how you move between them. Specs 001 to 008 define the behavior and the service; this spec defines what the leader and the members see and do. Screens talk to the service only through the API contract ([frontend/docs/api-contract.md](../../frontend/docs/api-contract.md)) and are built only with the approved design system ([frontend/design-system/README.md](../../frontend/design-system/README.md)).
- **Includes**: the screen work that the plans of specs 002, 003, 006, 007 and 008 listed; this spec's plan takes it over so the UI has a single owner.
- **Doesn't include**: business rules or endpoints. If a screen needs something the contract doesn't have, the contract and the owner spec change first.

## Screen map

| Screen | What it's for | Spec behind it |
|---|---|---|
| Projects | List of projects, open one, create a new one | 001 |
| New project | Project and team form, then start planning | 001, 002 |
| Planning | Live progress of the six stages and the proposal waiting for a decision | 002, 005 |
| Board | Kanban with sprints, cards, checklist and warnings | 003, 008 |
| Plan | Roadmap, methodology and architecture, each with where it came from | 004 |
| Documents | Generated specs and diagrams, versions, regenerate and edit | 006 |
| Integrations | GitHub repo, members' GitHub users, publish issues | 007 |
| Settings | Edit the project and the team, auto-approve | 001 |
| Activity | Drawer available from every project screen: live feed and history | 005 |

Inside a project, a narrow rail on the left holds the sections as icons (Planning, Board, Plan, Documents, Integrations) and, at the bottom, theme and settings. A top bar shows the project switcher on the left, the views of the current section in the center (the sprints on the board; Roadmap, Methodology and Architecture in the plan) and activity on the right.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a project and start planning (Priority: P1)

The leader opens the app, chooses "New project", describes what they want to build, enters the team member by member and, optionally, picks the methodology and turns on auto-approve. When they save, the app takes them to the planning screen and the agents start.

**Why this priority**: it's the first step of the demo (constitution, principle 1).

**Independent Test**: with the app connected to a fake service, create a project with two members and land on the planning screen with the first stage working.

**Acceptance Scenarios**:

1. **Scenario**: Create and start
   - **Given** the projects screen
   - **When** the leader fills in the form with two members and saves
   - **Then** the project is created, planning starts and the planning screen shows the first agent working

2. **Scenario**: Invalid field
   - **Given** the form with two members named "Ana"
   - **When** the leader saves
   - **Then** the message appears under the second name, nothing typed is lost and the form isn't sent until it's fixed

3. **Scenario**: Add and remove members
   - **Given** the form
   - **When** the leader adds a third member row and removes the first
   - **Then** the team shows two rows and the defaults (mid seniority, 20 hours) are already filled in on the new one

---

### User Story 2 - Follow the planning and decide on each proposal (Priority: P1)

On the planning screen the leader sees the six stages in order, which agent is working right now, and the proposal waiting for them: what the agent decided, why, and the main facts. They approve it, adjust it in place or reject it with a reason, and the next stage starts. With auto-approve, the stages go by on their own and each one shows that it was approved automatically.

**Why this priority**: it's the heart of the demo and of the product's principle that everything goes through the user (constitution, principle 8).

**Independent Test**: start planning on the fake service and go through the six stages approving one, adjusting one and rejecting one; the board opens when the last stage is approved.

**Acceptance Scenarios**:

1. **Scenario**: Live progress
   - **Given** the planning screen open
   - **When** an agent starts and finishes its stage
   - **Then** the stage shows as working and then as waiting for the leader, without reloading

2. **Scenario**: Approve
   - **Given** the methodology proposal waiting
   - **When** the leader approves it
   - **Then** the proposal shows as approved, the next stage starts working and the leader sees "Applying" until it does

3. **Scenario**: Adjust
   - **Given** the methodology proposal waiting
   - **When** the leader changes the iteration length from 2 to 1 week and approves
   - **Then** the proposal shows as adjusted with the leader's version

4. **Scenario**: Reject with a reason
   - **Given** the roadmap proposal waiting
   - **When** the leader rejects it without writing a reason
   - **Then** the app asks for the reason and doesn't send anything until there is one

5. **Scenario**: Stage that needs the leader
   - **Given** a stage rejected three times in a row
   - **When** the leader opens the planning screen
   - **Then** the stage says it needs them and offers to retry it or to adjust the last proposal

6. **Scenario**: Failed stage
   - **Given** an agent failed
   - **When** the leader looks at the stepper
   - **Then** the failed stage says so in words with the reason and offers "Retry"

---

### User Story 3 - Work on the board (Priority: P1)

Members see the current sprint as columns of cards. They drag cards between columns and within a column, open a card to edit it and check off its checklist, switch sprints and see each sprint's load against the team's capacity. Warnings (WIP limit, overloaded sprint) are visible but never stop them.

**Why this priority**: it's the end of the demo flow (constitution, principle 1).

**Independent Test**: on the fake service with a built board, move a card to another column, reload, and see it where it was left.

**Acceptance Scenarios**:

1. **Scenario**: Instant move
   - **Given** a card in "To do"
   - **When** a member drags it to "In progress"
   - **Then** it moves immediately and stays there after reloading

2. **Scenario**: Failed move
   - **Given** the service is unreachable
   - **When** a member moves a card
   - **Then** the card goes back to where it was and a message says it couldn't be saved, with a retry

3. **Scenario**: WIP warning
   - **Given** "In progress" is at its limit
   - **When** a member moves one more card there
   - **Then** the card stays there and the column shows the warning in words

4. **Scenario**: Edit and checklist
   - **Given** a card open
   - **When** the member checks the last checklist item of a card in progress
   - **Then** the app suggests moving it to review, without moving it

5. **Scenario**: Kanban board
   - **Given** a project whose methodology is Kanban
   - **When** a member opens the board
   - **Then** all tasks show in one continuous board, without a sprint selector or capacity

---

### User Story 4 - See the plan (Priority: P2)

The leader and the members open the plan: a visual roadmap by phases and weeks with the progress of each epic, the methodology with its ceremonies and discarded alternatives, and the architecture with its components and decisions. Each part says which agent wrote it, why, and how it was approved.

**Why this priority**: it completes the demo, but you can work on the board without it.

**Independent Test**: with an approved plan on the fake service, open the plan and see the three parts with their origin.

**Acceptance Scenarios**:

1. **Scenario**: Not generated yet
   - **Given** a project whose architecture stage is still waiting for approval
   - **When** the leader opens the plan
   - **Then** the architecture part says it's waiting for approval and links to the proposal, without showing its content

2. **Scenario**: Current week
   - **Given** a board built three weeks ago
   - **When** the leader opens the roadmap
   - **Then** the current week and its phase stand out, and each epic shows its progress

---

### User Story 5 - Follow the activity (Priority: P2)

From any project screen, the leader opens the activity drawer and sees what's happening live (agents, people, GitHub, system) and, scrolling down, the history. Each item links to what it's about.

**Why this priority**: it's what makes the agents' work visible (constitution, principle 3), but the planning screen already shows the essentials.

**Independent Test**: with the drawer open, approve a proposal in another tab; the item appears at the top without reloading.

**Acceptance Scenarios**:

1. **Scenario**: Reconnection
   - **Given** the connection dropped for a few seconds
   - **When** it comes back
   - **Then** the missed items appear in order, and if too many were missed, the screen reloads its data

2. **Scenario**: Link
   - **Given** an item about a proposal
   - **When** the leader selects it
   - **Then** the app opens that proposal

---

### User Story 6 - Manage projects and settings (Priority: P2)

The leader sees all their projects with their status, opens one, and edits its data, its team and auto-approve from settings. The methodology can't be changed once planning has started, and the app says why.

**Why this priority**: needed to come back to a project and to show replanning after a team change.

**Independent Test**: open an existing project from the list, change a member's hours in settings and see the change saved.

**Acceptance Scenarios**:

1. **Scenario**: Locked methodology
   - **Given** a project already planning
   - **When** the leader opens settings
   - **Then** the methodology can't be changed and a short text says planning already started

---

### User Story 7 - Read and maintain the documents (Priority: P3)

The leader reads the general spec, the specs per epic and the diagrams, drawn inside the app. They can see older versions, ask to regenerate a document with instructions, or edit it by hand. Outdated documents say so.

**Why this priority**: extra value after the demo flow.

**Independent Test**: open the general spec, regenerate it with an instruction, approve the new proposal and see version 2 with version 1 still available.

**Acceptance Scenarios**:

1. **Scenario**: Diagram that can't be drawn
   - **Given** a diagram whose source can't be rendered
   - **When** the leader opens it
   - **Then** the app shows the source and says it couldn't be drawn, instead of an empty space

2. **Scenario**: Someone saved first
   - **Given** the leader is editing version 2
   - **When** they save and someone already saved version 3
   - **Then** the app says so and offers to reload or to copy their text

---

### User Story 8 - Connect GitHub and publish issues (Priority: P3)

In Integrations, the leader connects the repo, enters each member's GitHub user and publishes the pending tasks as issues. Board cards show their issue number with a link. Without a token, a banner says nothing is sent to GitHub.

**Why this priority**: round 3 feature.

**Independent Test**: connect a repo on the fake service, publish the tasks and see each card with its issue number.

**Acceptance Scenarios**:

1. **Scenario**: Repo without access
   - **Given** a repo the token can't see
   - **When** the leader connects it
   - **Then** the message explains the reason in plain words and the project stays without a repo

2. **Scenario**: Token never shown
   - **Given** a project with a token saved
   - **When** the leader opens Integrations
   - **Then** the token field is empty and only says that a token is saved

---

### User Story 9 - Replan and close sprints (Priority: P3)

From the board, the leader closes a sprint or asks for a replan with a reason. The replan arrives as a proposal that lists each change with its reason, and the leader can drop changes before approving.

**Why this priority**: round 3 feature.

**Independent Test**: ask for a replan on the fake service, drop one change and approve; the board shows the rest of the changes applied.

**Acceptance Scenarios**:

1. **Scenario**: Drop a change
   - **Given** a replan proposal with four changes
   - **When** the leader drops one and approves
   - **Then** the board reflects the other three

---

### Edge Cases

- What if the service is unreachable? Every action shows a message with a retry, optimistic changes go back, and nothing typed is lost.
- What if an id in the address doesn't exist? A "not found" screen with a way back to the projects.
- What if someone else resolved the proposal first (another tab, auto-approve)? The app refreshes it and says it was already resolved.
- What if a project has no plan yet? The board, plan and documents say what's missing and link to the planning screen; no empty grids.
- What if names or descriptions are very long? They're cut with an ellipsis in cards and shown in full when opened.
- What if there are many pending proposals (documents per epic)? They're listed with "Approve all" and the result of each.
- What if the screen is narrow? Under 768px the rail turns into a section menu in the top bar and the board scrolls sideways by column; nothing overlaps.
- What if the person prefers less motion? Movements and transitions are turned off.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide the screens in the screen map and, inside a project, a narrow icon rail for the sections plus a top bar with the views of the current section. No wide sidebar with labels.
- **FR-002**: Every screen MUST be built only with the approved design system: its colors, type, shapes, spacing and icon set, and its rules (no status dots, no separator lines, no lines or small labels around text, no em dashes, no dot separators, no emojis, no side strokes on cards, at most three numbers per screen). If something is missing, it's added to the design system first.
- **FR-003**: The app MUST offer light and dark themes, follow the system preference by default and remember the person's choice.
- **FR-004**: The app MUST talk to the service only as the API contract describes, and react to each error code as the contract says.
- **FR-005**: Board moves MUST show immediately and go back with a message if saving fails.
- **FR-006**: After an action that continues in the background, the app MUST NOT ask the service repeatedly; it MUST update when the live activity says something changed.
- **FR-007**: The app MUST work against a fake service, without a backend, so the full demo flow can be shown and developed (constitution, principle 6).
- **FR-008**: Forms MUST validate the same rules as the service before sending, show each error under its field, and keep what was typed.
- **FR-009**: A state MUST always be shown as an icon plus a word; color alone never carries meaning.
- **FR-010**: Everything MUST be usable with the keyboard, including moving cards, with a visible focus ring, and every icon-only button MUST have an accessible name.
- **FR-011**: Every text MUST meet 4.5:1 contrast in both themes.
- **FR-012**: The UI text MUST be in Spanish (the language of the team and the demo), short and direct, following the design system's voice. Code, identifiers and docs stay in English.

### Key Entities

- **Screen**: each entry of the screen map, with the specs it shows and the contract groups it uses.
- **Theme**: light or dark, chosen by the system or by the person.
- **Live connection**: the project's activity stream that keeps screens up to date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the fake service, the full demo (create project, approve the six stages, move a card) takes under 3 minutes and no step needs a reload.
- **SC-002**: A person who never used the app creates a project with three members in under 2 minutes, on their first try.
- **SC-003**: A card move shows on screen in under 100 ms.
- **SC-004**: A review of every screen against the design system rules finds 0 violations, in both themes.
- **SC-005**: Every screen shows its first content in under 2 seconds on a regular laptop.
