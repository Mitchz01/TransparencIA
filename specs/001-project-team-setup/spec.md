# Feature Specification: 001 · Project and team setup

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: sandredev  
**Reviewer**: codigotpx  
**Use cases**: UC-01, UC-02 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: the service (backend) to create, read and edit a project with its team, validate the data and leave the project ready for the agents to start (UC-03).
- **Doesn't include**: the screens to create, view and edit the project and its team. This spec covers the service only and its stories are tested directly against it; who builds the screens is still to be decided in [specs/README.md](../README.md).
- **Doesn't include**: generating the plan (spec 002), the request to start planning (spec 002) or replanning (spec 008). This spec leaves the project ready and reports when the team changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a project with its team (Priority: P1)

The leader enters what they want to build (name, description, duration in weeks), optionally picks the methodology, decides whether the agents' proposals are approved automatically, and enters their team: each member with name, role, seniority, hours per week and skills. The system saves the project in draft status, with its team, ready for the agents to start planning.

**Why this priority**: it's the first step of the demo (constitution, principle 1). Without a project and a team, the agents have nothing to plan.

**Independent Test**: send a project with two members to the service and verify that the response contains the project with an id, draft status and both members with their data. Reading it later returns the same data.

**Acceptance Scenarios**:

1. **Scenario**: Full setup
   - **Given** no project exists
   - **When** the leader creates "Online store" (8 weeks, Scrum, auto-approve off) with a senior developer at 40 h and a junior designer at 20 h
   - **Then** the project is saved in draft status, with Scrum, auto-approve off and both members with their role, seniority, hours and skills

2. **Scenario**: No methodology chosen
   - **Given** the leader doesn't pick a methodology
   - **When** they create the project
   - **Then** it's set to "let the agents recommend", and the agents will propose one (spec 002)

3. **Scenario**: Member defaults
   - **Given** the leader enters a member with only a name and a role
   - **When** they create the project
   - **Then** the member gets mid seniority, 20 h per week and no skills

4. **Scenario**: Invalid data
   - **Given** the leader enters no members, or a duration of 0, or leaves the name empty
   - **When** they try to create the project
   - **Then** nothing is saved and the response says which field is wrong and why

5. **Scenario**: Duplicate names
   - **Given** the leader enters two members named "Ana"
   - **When** they try to create the project
   - **Then** nothing is saved and the response says each member needs a different name

6. **Scenario**: Creating doesn't start planning
   - **Given** a newly created project
   - **When** the leader hasn't asked to plan yet
   - **Then** the project stays in draft and no agent starts working. Planning starts with a separate request, defined in spec 002 (UC-03)

---

### User Story 2 - Read a project (Priority: P1)

The leader or a member asks for a project and gets all its data and its team, exactly as saved.

**Why this priority**: editing (story 3), the agents (spec 002) and the plan views (spec 004) need it.

**Independent Test**: create a project, ask for it by id and compare it with what was sent. Asking for an id that doesn't exist returns "not found".

**Acceptance Scenarios**:

1. **Scenario**: Existing project
   - **Given** the project "Online store" exists with two members
   - **When** it's requested by id
   - **Then** its data, status and both members are returned

2. **Scenario**: Missing project
   - **Given** no project exists with that id
   - **When** it's requested
   - **Then** the response is "not found" and nothing is created

---

### User Story 3 - Edit the project and the team (Priority: P2)

The leader changes project data (name, description, duration, methodology, auto-approve) or the team: adds members, removes members or changes someone's role, seniority, hours or skills. Only what the leader specifies changes; everything else stays the same.

**Why this priority**: teams change (someone joins, someone leaves, hours change) and the plan has to be adjustable. Creating is enough for the demo, so this comes after.

**Independent Test**: create a project with two members, add a third and change someone's hours; when read, it has three members, the new hours and everything else unchanged.

**Acceptance Scenarios**:

1. **Scenario**: Partial change
   - **Given** a project with auto-approve off
   - **When** the leader only turns auto-approve on
   - **Then** auto-approve is on and name, description, duration, methodology and team don't change

2. **Scenario**: Add, edit and remove members
   - **Given** a project with Ana and Beto
   - **When** the leader adds Carla, changes Ana's hours to 30 and removes Beto
   - **Then** the team has Ana (30 h) and Carla, and Beto is gone

3. **Scenario**: Leaving the team empty
   - **Given** a project with a single member
   - **When** the leader tries to remove them
   - **Then** no change is applied and the response says the team needs at least one member

4. **Scenario**: Missing project
   - **Given** no project exists with that id
   - **When** the leader tries to edit it
   - **Then** the response is "not found"

---

### User Story 4 - Report that the team changed (Priority: P3)

When the leader changes the team, the system saves the change and reports that the team changed, with the detail of who joined, who left and what was edited. This spec only reports it; what to do with it is decided elsewhere: the live activity feed shows it (spec 005) and, if a plan is already applied, the agents propose a replan (spec 008, FR-010). This spec doesn't replan anything (constitution, principle 8).

**Why this priority**: it keeps the plan from drifting away from the real team, but replanning itself is round 3 (spec 008).

**Independent Test**: add one member and remove another; a single "team changed" event is published with both changes. Changing only the project name publishes nothing.

**Acceptance Scenarios**:

1. **Scenario**: Team change
   - **Given** a project with Ana and Beto
   - **When** the leader adds Carla and removes Beto in the same edit
   - **Then** the change is saved and a single "team changed" event is published saying Carla joined and Beto left

2. **Scenario**: Change that doesn't affect the team
   - **Given** a project with an applied plan
   - **When** the leader only changes the name, the description or auto-approve
   - **Then** the change is saved and no event is published

3. **Scenario**: Invalid edit
   - **Given** a project with a single member
   - **When** the leader tries to remove them
   - **Then** nothing is saved and no event is published

---

### Edge Cases

- **Editing while planning**: with manual approval, "planning" can last hours or days, so the team, name, description and auto-approve can be changed. Already approved stages don't change and the following ones use the new team (same as spec 002). The only thing that can't change is the methodology, because the methodology stage already used it or is using it; it's rejected with a clear message.
- **Removing a member with assigned tasks**: their pending tasks become unassigned (they aren't deleted) until a replan (spec 008). Done tasks keep the name of whoever did them.
- **Two members with the same name**: not allowed within a project, because the agents assign work by name (spec 002). The comparison ignores case and extra spaces ("ana " and "Ana" count as the same name).
- **Renaming a member**: doesn't change who owns their tasks; the tasks stay assigned to that person under their new name.
- **Repeated skills or skills with spaces**: saved without duplicates and without extra spaces.
- **Whitespace-only text**: a project name, member name or role that is only spaces is treated as empty.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow creating a project with name, description, duration in weeks, methodology (optional), auto-approve and at least one member.
- **FR-002**: The system MUST accept as methodology "let the agents recommend" (default), Scrum, Kanban, Scrumban, XP or Shape Up, and reject anything else.
- **FR-003**: The system MUST store each member's name, role, seniority (junior, mid or senior; mid by default), hours per week (20 by default) and skills (empty by default).
- **FR-004**: The system MUST reject the creation or the edit if the project name, the description, or a member's name or role is missing, if there are no members, if two members share a name, if the duration isn't between 1 and 52 weeks, or if a member's hours aren't between 1 and 60, saying which field fails.
- **FR-005**: Every new project MUST start in draft status. Creating a project MUST NOT start planning: a separate request does that (spec 002).
- **FR-006**: The system MUST return a project with all its data and its team given its id, or "not found" if it doesn't exist.
- **FR-007**: The system MUST allow editing any project or team data, changing only what's specified, also while the project is "planning".
- **FR-008**: An invalid edit MUST NOT apply any change (all or nothing).
- **FR-009**: The system MUST reject changing the methodology once planning has started.
- **FR-010**: Every edit that adds or removes members, or changes someone's name, role, seniority, hours or skills, MUST publish a single "team changed" event with the detail of the changes. Edits that don't touch the team MUST NOT publish it.
- **FR-011**: The system MUST work without a Gemini key (mock mode, constitution principle 6).

### Key Entities *(include if feature involves data)*

- **Project**: what the team wants to build. Name, description, duration in weeks, requested methodology, auto-approve, status (draft, planning, ready, error), team and creation date. The approved plan and the GitHub repo are filled in by other specs.
- **Member**: a person on a project's team. Name, role, seniority, hours per week and skills. Belongs to a single project. The GitHub username is added by spec 007, from Integrations (007, FR-012).
- **"Team changed" event**: says a project's team changed, with the detail of who joined, who left and what was edited for each member. The live activity feed shows it (spec 005) and replanning uses it (spec 008).

### Contracts with other specs (agreed with Mitchz01)

- **001 → 002**: the agents receive the project's name, description, duration, requested methodology and the full team (name, role, seniority, hours and skills of each member). They don't receive auto-approve, which only affects proposals (spec 005). The "start planning" request and the single-active-planning rule are defined by spec 002.
- **001 → 008**: the "team changed" event is published for any member change (joins, leaves, and changes of name, role, seniority, hours or skills). Which changes trigger a replan is decided by spec 008: joins, leaves and changes of role, seniority or hours; renaming or changing skills doesn't (008, FR-010). With auto-approve on, editing the team does **not** reorganize the board by itself: automatic replans always wait for the leader (008, FR-016).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Creating, reading or editing a project with its team responds in under 1 second.
- **SC-002**: 100% of the data sent when creating or editing comes back identical when reading the project.
- **SC-003**: 100% of the invalid cases in FR-004 are rejected without saving anything and with a message that names the field.
- **SC-004**: All acceptance scenarios of stories 1 to 4 are verified with automated tests, without a Gemini key.
