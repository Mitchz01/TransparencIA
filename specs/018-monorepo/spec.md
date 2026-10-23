# Feature Specification: Monorepo with a separate public portal

**Created**: 2026-10-23  
**Status**: Approved

Spec 017 adds a second audience: the public (contracting entity, citizens, oversight groups) opens a
project's transparency portal from a QR code, on a phone, with no account. The team app (sign in, board,
planning, the "Transparencia" tab) keeps iterating at its own pace. This feature splits the repository so
both products live side by side: the team app and the public portal as two separate frontends that share
the look and the data shapes, served by the same backend.

Actors:
- **Team developers**: work on the team app without shipping its code (board, planning, accounts) to the
  public.
- **Portal developers**: work on the public portal, a light phone-first page, without the team app's
  session, routes or dependencies.
- **Public**: opens the portal from a link or QR.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two apps, one repository (Priority: P1)

A developer clones the repository, installs once, and can run the team app, the public portal or both,
each on its own port, against the same backend.

**Why this priority**: it's the split itself.

**Independent Test**: install from the root, start the backend, the team app and the portal, and open both.

**Acceptance Scenarios**:

1. **Scenario**: Run both
   - **Given** a fresh clone
   - **When** the developer installs once from the root and starts each app
   - **Then** the team app and the portal open on their own ports and both reach the backend
2. **Scenario**: Checks per app
   - **When** the developer runs the type check, tests and lint from the root
   - **Then** they run for every app and shared package, and pass

---

### User Story 2 - The portal ships alone (Priority: P1)

The public portal is built on its own. Its bundle doesn't carry the team app's screens, session handling,
board or planning code.

**Why this priority**: the public opens it on a phone over mobile data, often from a tunnel.

**Independent Test**: build the portal and check that none of the team app's screens are in its output.

**Acceptance Scenarios**:

1. **Scenario**: Unknown link
   - **When** someone opens a portal link that doesn't exist or isn't published
   - **Then** they see "este proyecto no existe o no es público"
2. **Scenario**: No session
   - **When** someone opens the portal signed out
   - **Then** nothing asks them to sign in

---

### User Story 3 - One look, one set of shapes (Priority: P1)

Both apps use the same design system (tokens, components, rules) and the same transparency data shapes,
so a change to a shared component or shape reaches both, and they can't drift apart.

**Why this priority**: the team tab and the portal show the same traffic light and budget lines (spec 017).

**Independent Test**: change a token in the shared package and see it in both apps.

**Acceptance Scenarios**:

1. **Scenario**: Shared design system
   - **Then** both apps import the design system from one shared package, and the design rules check runs
     on both apps and the package
2. **Scenario**: Shared shapes
   - **Then** both apps import the transparency types from one shared package that mirrors the backend

---

### Edge Cases

- A component only the team app needs (toasts tied to the team's session errors) stays in the team app.
- The backend stays one service; the portal only calls its public endpoints.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST hold the team app, the public portal and the backend as separate apps,
  and the shared design system and data shapes as shared packages.
- **FR-002**: One install from the root MUST set up every frontend app and package.
- **FR-003**: Each app MUST start, build, type check, test and lint on its own, and all of them MUST be
  runnable at once from the root.
- **FR-004**: The portal MUST NOT depend on the team app's code.
- **FR-005**: The design rules check MUST cover both apps and the shared design system.
- **FR-006**: Existing behavior of the team app and the backend MUST NOT change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every backend and team app test that passed before the split still passes.
- **SC-002**: The portal's build contains none of the team app's screens.
- **SC-003**: A new developer runs both apps from the README in under 5 minutes.

## Out of scope

- Splitting the backend into a separate public service.
- Publishing the shared packages outside the repository; a build cache or task runner.
