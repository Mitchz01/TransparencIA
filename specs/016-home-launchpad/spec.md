# Feature Specification: 016 · Home launchpad

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: UC-01 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: the home screen (`/`) and the frame around the screens outside a project (home and new project): a sidebar, a hero where you describe a project, and the projects below it.
- **Doesn't include**: new endpoints or data, creating a project straight from the hero (your role may be required, spec 015), and the screens inside a project (rail and top bar stay as they are).

## User Scenarios & Testing *(mandatory)*

The reference is the dashboard of tools like Lovable: the first thing you see is a question and a box to answer it, not a list. Today `/` is a title and a grid of cards, and it reads like any admin panel.

### User Story 1 - Describe a project from the first screen (Priority: P1)

A signed-in person lands on `/`, sees "¿Qué proyecto levantamos hoy, Ana?" over a moving gradient, types what they want to build, picks a methodology and a duration if they want, and presses Enter. The new project form opens with that description, methodology and duration filled in and a suggested name.

**Why this priority**: it's the screen the jury sees first, and it puts the product's promise (describe it, the agents plan it) in one gesture.

**Independent Test**: on the fake service, open `/`, type a description, press Enter and check that `/projects/new` shows it with a name made from its first words.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** it opens, **Then** it greets the person by first name, or without a name when there is none.
2. **Given** an empty box, **When** the person looks at the send button, **Then** it's disabled.
3. **Given** a description, **When** the person presses Enter, **Then** `/projects/new` opens with the description, methodology and duration filled in, a suggested name from its first five words and the focus on the name. Shift+Enter adds a line instead.
4. **Given** reduced motion, **When** the home screen opens, **Then** the gradient and the placeholder don't move.

---

### User Story 2 - Find your projects below the hero (Priority: P2)

Below the hero, a panel lists the projects with a generated cover each, filtered by recent ones or the ones you lead, with a search box. Templates fill the box with a rich description.

**Independent Test**: with the demo data, the panel shows "Tienda online" with its status; "Lidero" shows only the projects you lead; a template fills the box.

**Acceptance Scenarios**:

1. **Given** projects, **When** the panel loads, **Then** each one shows a cover that is always the same for the same project, its name, status, role, weeks, members and date.
2. **Given** a search, **When** the person types, **Then** only projects whose name matches remain.
3. **Given** no projects, **When** the home opens, **Then** the panel says "Todavía no hay proyectos" and shows the templates.
4. **Given** a template, **When** the person picks it, **Then** the box above fills with its description and gets the focus.

---

### User Story 3 - Move around outside a project (Priority: P3)

A sidebar holds "Nuevo proyecto" (focuses the box), "Buscar" (focuses the search), "Proyectos" (scrolls to the panel), the four latest projects, an invitation card, the theme and the account. Under 1024 px it's a drawer opened from a menu button.

The pill above the greeting explains what the agents do and leads to the GitHub connection of the latest project.

## Requirements *(mandatory)*

- **FR-001**: The home greets by first name (`me.name`) and offers a box to describe a project, with methodology (default "Que elijan los agentes") and duration (4, 6, 8 or 12 weeks, default 8).
- **FR-002**: Sending the box never creates a project; it opens the new project form prefilled.
- **FR-003**: The latest projects are ordered by creation date, newest first.
- **FR-004**: A project's cover is derived only from its id.
- **FR-005**: Everything works with the keyboard, in both themes and at 375 px without horizontal scroll. UI text in Spanish.

### Design system exceptions

1. The home hero is the only surface in the app with an animated mesh gradient (`mesh-1` to `mesh-6`). It moves only with `transform`, pauses while the tab is hidden and is static under `prefers-reduced-motion`.
2. That gradient replaces the `glow` on that screen: the two are never used together.
3. The greeting on the gradient is `on-mesh` (white) and grows to 48 px from 768 px. The gradient's top (`mesh-5`) is dark in both themes, so the greeting passes 4.5:1.

## Success Criteria *(mandatory)*

- **SC-001**: From `/`, a project description reaches the new project form in one keystroke (Enter).
- **SC-002**: No new endpoints; `npm run typecheck`, `npm run lint` and `npm test` pass.
