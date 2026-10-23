# Feature Specification: 015 · Accounts, invitations and project roles

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: UC-15, UC-16, UC-17 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: accounts (sign up, sign in, sign out) with email and password, and a personal profile (name, photo, what you do, seniority, hours, skills) that is brought into each project you join.
- **Includes**: inviting people to a project with a link, joining with it, and two permissions per project: **Leader** and **Member**, on top of the team role the agents already use (Frontend, Design…).
- **Includes**: every project and everything inside it is only visible to its members; leader-only actions are rejected for members.
- **Includes**: the screens for all of the above (sign in, sign up, profile, join, team), following spec 009 and the design system.
- **Changes spec 001**: the leader no longer types the team. The creator is the first member (Leader) and everyone else joins with the link. The leader still edits each member's team role, seniority and hours, and removes members. "Team changed" keeps being published on joins, leaves and edits (001, FR-010).
- **Changes the constitution, principle 5**: "no user auth until it's needed" becomes "accounts with email and password; nothing more until it's needed".
- **Doesn't include**: signing in with Google, GitHub or SSO (the buttons are shown but only say "Próximamente"), uploading a profile photo (only the demo accounts have one; everyone else shows their initials), email verification, password reset, sending emails, two-factor auth, deleting an account, organizations or workspaces, and showing who did each action in the activity feed.
- **Doesn't include**: moving projects created before this feature to accounts. The demo starts from an empty database.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account and sign in (Priority: P1)

A person signs up with their name, email and password and lands in the app already signed in. Later they sign in with email and password and stay signed in on that device until they sign out. Without signing in, nothing in the app is reachable except the sign in and sign up screens and a join link's preview.

**Why this priority**: every other story needs to know who is using the app.

**Independent Test**: sign up, sign out, sign in again and read "my account"; without a session, asking for the project list is rejected.

**Acceptance Scenarios**:

1. **Scenario**: Sign up
   - **Given** no account exists for ana@team.dev
   - **When** Ana signs up with her name, that email and an 8+ character password
   - **Then** the account is created, she is signed in, and she is asked to fill in her profile (Story 2)

2. **Scenario**: Email already in use
   - **Given** an account exists for ana@team.dev
   - **When** someone signs up with "ANA@team.dev "
   - **Then** nothing is created and the email field says it's already registered

3. **Scenario**: Wrong credentials
   - **Given** an account for ana@team.dev
   - **When** someone signs in with a wrong password, or with an email that has no account
   - **Then** they aren't signed in and see the same message in both cases, without saying which part was wrong

4. **Scenario**: Sign out
   - **Given** Ana is signed in
   - **When** she signs out
   - **Then** that device's session ends and the app goes back to the sign in screen

5. **Scenario**: No session
   - **Given** nobody is signed in on this device
   - **When** they open any project or the project list
   - **Then** they are sent to sign in, and after signing in they land where they were going

6. **Scenario**: Google, GitHub and SSO buttons
   - **Given** the sign in screen
   - **When** the person presses "Continuar con Google", "Continuar con GitHub" or "Continuar con SSO"
   - **Then** a short message says it's coming soon and nothing else happens

---

### User Story 2 - Fill in my profile once (Priority: P1)

Right after signing up, one short screen asks what you do (a role chosen from common ones or typed), your seniority, how many hours a week you usually have and your skills. It takes seconds, every field has a sensible default and it can be skipped. You can change it later. Your profile is what a project takes when you join it, so the leader doesn't have to type anything.

**Why this priority**: it replaces the leader typing each member's data (spec 001), which is the point of the feature.

**Independent Test**: save a profile with role "Backend", senior, 30 h and two skills; reading the account returns them. Skipping leaves mid seniority, 20 h, no skills and no role.

**Acceptance Scenarios**:

1. **Scenario**: Full profile
   - **Given** Ana just signed up
   - **When** she picks "Backend", senior, 30 h and adds "Python" and "SQL"
   - **Then** her profile has them and she goes to her project list

2. **Scenario**: Skip
   - **Given** Ana just signed up
   - **When** she skips the profile
   - **Then** her profile has no role, mid seniority, 20 h and no skills, and she goes to her project list

3. **Scenario**: Edit later
   - **Given** Ana already belongs to a project as "Backend"
   - **When** she changes her profile role to "Fullstack"
   - **Then** her profile changes but her role in that project stays "Backend" (the project's data is the leader's call)

4. **Scenario**: Change of name
   - **Given** Ana belongs to two projects
   - **When** she changes her name in her profile
   - **Then** she appears with the new name in both projects and keeps her tasks

---

### User Story 3 - Create a project and become its leader (Priority: P1)

A signed in person creates a project with its name, description, duration, methodology and auto-approve, without typing any team. They become its first member, as Leader, with their profile's role, seniority, hours and skills. The project list only shows the projects you belong to, with your permission in each.

**Why this priority**: without it there's nothing to invite people to.

**Independent Test**: as Ana, create a project with no members in the request; it has exactly one member, Ana, as Leader with her profile's data. Beto, signed in, doesn't see it in his list and can't open it.

**Acceptance Scenarios**:

1. **Scenario**: Create
   - **Given** Ana is signed in with role "Backend", senior, 30 h
   - **When** she creates "Online store"
   - **Then** the project is in draft with one member, Ana, Leader, Backend, senior, 30 h

2. **Scenario**: No role in the profile
   - **Given** Ana skipped her profile
   - **When** she creates a project
   - **Then** the form asks for her role in this project (prefilled when her profile has one) and doesn't create it until she gives one

3. **Scenario**: Only my projects
   - **Given** Ana created "Online store" and Beto created "CRM"
   - **When** Ana opens her project list
   - **Then** she sees "Online store" as Leader and not "CRM"

4. **Scenario**: Someone else's project
   - **Given** Beto doesn't belong to "Online store"
   - **When** he asks for it, or for its board, plan, documents or activity
   - **Then** he gets "not found", the same as for a project that doesn't exist

---

### User Story 4 - Invite with a link and join (Priority: P1)

The leader copies the project's invitation link and sends it however they like (chat, email). Whoever opens it sees the project's name and its leader, and joins with one button. If they aren't signed in, they sign in or sign up first and come back to the same link. They join as Member with their profile's data; the role field is shown prefilled so they can confirm it, and it's required. Joining publishes "team changed", so with an applied plan the agents propose a replan (spec 008).

**Why this priority**: it's how the team is formed now; without it a project has a single person.

**Independent Test**: Ana gets the link; Beto, signed in, opens it and joins. The project has two members and Beto sees it in his list. A "team changed" event says Beto joined.

**Acceptance Scenarios**:

1. **Scenario**: Join
   - **Given** Ana's project and its link, and Beto signed in with role "Design", junior, 20 h
   - **When** Beto opens the link and presses "Unirme"
   - **Then** he is a Member with Design, junior, 20 h, he lands on the project, and "team changed" says Beto joined

2. **Scenario**: Not signed in
   - **Given** Carla has no account
   - **When** she opens the link
   - **Then** she sees the project name and leader and is asked to sign in or sign up; after signing up and her profile step she comes back to the link and can join

3. **Scenario**: Already a member
   - **Given** Beto already belongs to the project
   - **When** he opens the link again
   - **Then** nothing changes and he lands on the project

4. **Scenario**: New link
   - **Given** a link was shared by mistake
   - **When** the leader creates a new link
   - **Then** the old one stops working (opening it says the invitation isn't valid) and the new one works

5. **Scenario**: Invitations off
   - **Given** the leader turned the link off
   - **When** someone opens it
   - **Then** it says the invitation isn't valid, until the leader turns it on again (with a new link)

6. **Scenario**: Same name
   - **Given** the project already has a member named "Ana Gómez"
   - **When** another "Ana Gómez" joins
   - **Then** she joins as "Ana Gómez 2", because names are unique per project (spec 001), and the leader can change it

---

### User Story 5 - Leader and member permissions (Priority: P1)

A project has one or more Leaders and any number of Members. Leaders do everything. Members see everything in the project and do the work, but don't change how the project is set up.

| Action | Leader | Member |
|---|---|---|
| See the project, plan, board, documents and activity (UC-07, UC-14) | yes | yes |
| Work on the board: move, edit and add tasks, checklists (UC-06) | yes | yes |
| Edit the project and its settings, auto-approve (UC-02) | yes | no |
| Start planning, approve, adjust or reject proposals, replan, close sprints (UC-03, UC-04, UC-13) | yes | no |
| Connect GitHub, publish issues, request reviews (UC-09 to UC-11) | yes | no |
| Manage the team and the invitation link (UC-16, UC-17) | yes | no |

**Why this priority**: without it, inviting someone is the same as giving them the whole project.

**Independent Test**: as a Member, moving a task works; approving a proposal and editing the project are rejected with "forbidden" and change nothing. The same actions as Leader work.

**Acceptance Scenarios**:

1. **Scenario**: Member works on the board
   - **Given** Beto is a Member
   - **When** he moves a task to "In progress" and checks a checklist item
   - **Then** both changes are saved, as for a Leader

2. **Scenario**: Member can't decide
   - **Given** Beto is a Member and a proposal is waiting
   - **When** he tries to approve it, edit the project or connect GitHub
   - **Then** it's rejected as forbidden, nothing changes, and the app doesn't show him those buttons

---

### User Story 6 - Manage the team (Priority: P2)

On the team screen the leader sees each member with their team role, seniority, hours, skills and permission, and can change any of them, make someone Leader or Member, or remove them. A Member can leave a project. Every change publishes "team changed" like in spec 001 (permission changes don't, because they don't affect the plan).

**Why this priority**: profiles get people in fast, but the leader still decides who does what. The first version works with the profile's data, so this comes after.

**Independent Test**: change Beto's role to "Frontend" and make him Leader; when read, he has both. Removing Carla takes her out and her pending tasks become unassigned.

**Acceptance Scenarios**:

1. **Scenario**: Change someone's role in the project
   - **Given** Beto joined as "Design"
   - **When** the leader changes him to "Frontend", mid, 30 h
   - **Then** Beto has those values in this project, his profile doesn't change, and "team changed" is published

2. **Scenario**: Make someone leader
   - **Given** Beto is a Member
   - **When** Ana makes him Leader
   - **Then** Beto can do every leader action, and no "team changed" is published

3. **Scenario**: Remove a member
   - **Given** Carla has two pending tasks and one done
   - **When** the leader removes her
   - **Then** she no longer sees the project, the pending tasks become unassigned, the done one keeps her name (spec 001), and "team changed" says Carla left

4. **Scenario**: Leave a project
   - **Given** Beto is a Member
   - **When** he leaves the project
   - **Then** it's the same as being removed, and the project disappears from his list

5. **Scenario**: Last leader
   - **Given** Ana is the only Leader
   - **When** she tries to leave, remove herself or make herself Member
   - **Then** it's rejected saying the project needs a leader; she has to make someone else Leader first

---

### Edge Cases

- **Removed but still has the link**: they can join again while the link is the same; the leader creates a new link to prevent it.
- **Removed while looking at the project**: their next action is rejected as "not found" and the app sends them to their project list; they stop receiving the project's live activity.
- **A project with one member**: it's valid. The agents can plan with a team of one; the team grows as people join, and each join can trigger a replan (spec 008).
- **Member with no role**: impossible. Creating or joining asks for a role when the profile has none.
- **Name changes**: changing the profile name renames you in every project (it doesn't change who owns the tasks, spec 001). If the new name clashes with someone in a project, a number is added in that project only.
- **Email case and spaces**: "Ana@Team.dev " and "ana@team.dev" are the same account.
- **Many sign in attempts**: not limited in this version.
- **GitHub username**: it can be set in the profile and is copied when joining; the leader can still set it from Integrations (spec 007, US3).
- **Fake service (spec 009, FR-007)**: the app without backend starts signed in as a demo leader, with a demo member, so the full flow keeps working.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a person sign up with name, email and password, with a unique email (ignoring case and surrounding spaces), a valid email format and a password of at least 8 characters, and leave them signed in.
- **FR-002**: The system MUST let a person sign in with email and password and keep them signed in on that device for 30 days or until they sign out. A failed sign in MUST NOT say whether the email exists.
- **FR-003**: The system MUST never store or return passwords in readable form.
- **FR-004**: Without a valid session, every endpoint MUST be rejected as unauthorized, except signing up, signing in, the invitation preview, health and the GitHub webhook (which keeps its own signature check, spec 007).
- **FR-005**: Each account MUST have a profile: name, photo (optional, a link to an image; without one the initials are shown), role (optional), seniority (mid by default), hours per week (20 by default), skills (none by default) and GitHub username (optional), with the same limits as a member in spec 001 (FR-004).
- **FR-006**: Creating a project MUST NOT take a team. The creator MUST become its first member, as Leader, with their profile's data, and a role for this project if their profile has none.
- **FR-007**: The project list MUST only include the projects the person belongs to, each with their permission. Any project resource of a project they don't belong to MUST answer "not found".
- **FR-008**: Each project MUST have at most one active invitation link. The leader MUST be able to see it, create a new one (the old one stops working) and turn invitations off.
- **FR-009**: The invitation preview MUST show the project name and its leaders' names, and nothing else, without a session.
- **FR-010**: Joining with a valid link MUST add the person as Member with their profile's role (confirmed or typed when joining), seniority, hours, skills and GitHub username, and publish "team changed" (spec 001, FR-010). Joining a project you already belong to MUST change nothing.
- **FR-011**: Member names MUST stay unique per project: when a joining person's name clashes, a number is added ("Ana Gómez 2").
- **FR-012**: Members MUST be allowed only the actions in Story 5's table; any other action MUST be rejected as forbidden without changing anything.
- **FR-013**: The leader MUST be able to change a member's name, team role, seniority, hours, skills and permission, and remove members. Changes to member data MUST publish "team changed"; permission changes MUST NOT. Profile changes after joining MUST NOT change project data, except the name and the photo. A new photo MUST NOT publish "team changed".
- **FR-014**: A member MUST be able to leave a project. Leaving or being removed MUST unassign their pending tasks, keep their name on done tasks and end their access to the project, including its live activity.
- **FR-015**: A project MUST always keep at least one Leader; leaving, removing or demoting the last one MUST be rejected with a clear message.
- **FR-016**: The sign in screen MUST show "Continuar con Google", "Continuar con GitHub" and "Continuar con SSO", which only say the option is coming soon.
- **FR-017**: The screens MUST follow spec 009 (FR-002 to FR-012): design system, Spanish text, keyboard, contrast, errors under each field. Actions a member can't do MUST be hidden for them, not just disabled.
- **FR-018**: Everything MUST work without a Gemini key or a GitHub token (constitution, principle 6), and the app MUST keep working against the fake service.

### Key Entities *(include if feature involves data)*

- **Account**: a person who uses the app. Email (unique), password (never readable), creation date, and their profile.
- **Profile**: what a person brings to every project: name, photo, role, seniority, hours per week, skills, GitHub username.
- **Session**: a signed in device. Belongs to one account; ends after 30 days or on sign out.
- **Member** (from spec 001): now linked to one account and with a **permission** (Leader or Member). Its name, role, seniority, hours and skills are a copy of the profile taken when joining, edited by the leader from then on (the name and the photo follow the profile).
- **Invitation link**: a project's current link to join. Active or off; creating a new one replaces the previous one.

### Contracts with other specs

- **015 → 001**: creating a project no longer takes members (001 FR-001, FR-003 and Story 3 "add members" change); 001's validations, the "team changed" event and the edge cases about removing and renaming members still apply. Spec 001 is updated in the same PR as this spec's plan.
- **015 → 002, 008**: the agents still receive the team as names, roles, seniority, hours and skills; nothing changes for them. A join or leave is a "team changed" like before.
- **015 → 005, 007**: approving proposals and the GitHub actions become leader-only.
- **015 → 009**: new screens (sign in, sign up, profile, join, team) and changes to the new project form (no team) and to settings (the team moves to its own screen).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new person goes from opening an invitation link to being on the project's board in under 1 minute, including sign up and profile.
- **SC-002**: The leader adds someone to the team without typing any of that person's data.
- **SC-003**: 100% of the leader-only actions are rejected for a Member, and 100% of the project resources answer "not found" to someone outside the project, verified with automated tests.
- **SC-004**: No endpoint returns a password or password hash, verified with automated tests.
- **SC-005**: All acceptance scenarios of stories 1 to 6 are verified with automated tests, without a Gemini key or GitHub token.
