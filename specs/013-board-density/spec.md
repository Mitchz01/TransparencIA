# Feature Specification: 013 · A board you read at a glance

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: UC-05, UC-06 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: how the board screen (spec 009, User Story 3) uses its space: the header above the columns, the columns themselves and what a card shows.
- **Doesn't include**: new task data, new endpoints, creating tasks from the board, or changes to the task panel (spec 011). Moving cards, filters, replanning and closing a sprint work as today.

## User Scenarios & Testing *(mandatory)*

The references are boards such as Jira or Linear: a short header, each column as its own panel, and small cards that say what the task is and who has it. The detail lives in the task panel, not on the card.

Today, at 1536×864, the first card starts about 300 px down the screen, each card is about 200 px tall (title, two lines of description, a data row and a row with the assignee and a priority pill), and an empty column is just the words "Suelta una tarea aquí" floating on the page.

### User Story 1 - See the sprint's work as soon as the board opens (Priority: P1)

A member opens the board and, without scrolling on a laptop, sees the four columns with several cards each: what each task is, its key, its points and checklist, its priority and who has it.

**Why this priority**: the board is the screen the team checks every day. If the cards are big and start halfway down, it reads like a list of documents instead of a picture of the sprint.

**Independent Test**: on the fake service, open the board of "Tienda online" at 1536×864 and check that the first card starts in the top third of the screen and that each card with an assignee is at most about half as tall as today.

**Acceptance Scenarios**:

1. **Scenario**: A short header
   - **Given** the board of a sprint
   - **When** the member opens it
   - **Then** the sprint name and its goal share one line, the capacity and the actions sit on the right of that line, the filters are on the next line, and the columns start right below

2. **Scenario**: Columns as panels
   - **Given** a sprint with an empty column
   - **When** the member opens the board
   - **Then** every column is a panel with its own background, its name and count at the top, and the empty one still shows where to drop a task

3. **Scenario**: A compact card
   - **Given** a task in progress, high priority, 3 points, checklist 1 of 2, assigned to Marta
   - **When** the member looks at its card
   - **Then** the card shows the title (up to two lines), the checklist progress, and one row with "US-2", "1/2", "3 pts", "Alta" (flag icon plus word) and Marta's initials; the description is not on the card

4. **Scenario**: Who has it, also for screen readers
   - **Given** that same card
   - **When** a screen reader reads it, or the pointer rests on the initials
   - **Then** it says "Marta"

5. **Scenario**: Missing role
   - **Given** an unassigned task that needs the DevOps role, which nobody has
   - **When** the member looks at its card
   - **Then** the card says "Falta DevOps" with its icon, in the same row

---

### User Story 2 - The same board in dark mode and on a phone (Priority: P2)

The panels and cards keep their order of backgrounds in both themes (page, then column, then card) and on narrow screens the columns still scroll sideways one at a time.

**Why this priority**: the demo is shown in both themes, and the board has to stay usable at 360 px (spec 009).

**Independent Test**: switch to the dark theme and to 360 px: cards are lighter than their column, and the column panels scroll sideways starting on the first one with cards.

**Acceptance Scenarios**:

1. **Scenario**: Dark theme
   - **Given** the dark theme
   - **When** the member opens the board
   - **Then** the columns are a step lighter than the page and the cards a step lighter than the columns

2. **Scenario**: Dropping a card
   - **Given** a card being dragged
   - **When** it passes over a column
   - **Then** that column's panel changes its background, as today

---

### Edge Cases

- What if a title is very long? It's cut at two lines with an ellipsis and shown in full in the panel (spec 009).
- What if the data row doesn't fit (a linked issue plus a missing role)? It wraps to a second line; nothing overlaps.
- What if one column has many more cards than the rest? All the panels stretch to the tallest one, so every column stays a drop target down to the bottom.
- What if the sprint has no goal or end date? The header shows only what exists, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The board header MUST fit in one line for the sprint name, its goal, the capacity and the actions on screens 1280 px and wider, with the filters on the line below.
- **FR-002**: Each column MUST be a panel with its own background, its name and count inside it, and MUST stay a drop target along its full height.
- **FR-003**: A card MUST show the title (two lines at most), the checklist progress when it's partly done, and one data row with the key, checklist, points, linked issue, priority (icon plus word) and the assignee's initials or the missing role. It MUST NOT show the description.
- **FR-004**: The assignee's name MUST stay available to screen readers and as a tooltip on the initials.
- **FR-005**: Every text on a column or a card MUST meet 4.5:1 contrast in both themes (spec 009, FR-011).
- **FR-006**: The new backgrounds MUST be added to the design system before they're used (spec 009, FR-002).

### Key Entities

- **Task**: the same task of spec 003. No new fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1536×864, the first card starts in the top 250 px of the screen (today about 305 px).
- **SC-002**: At 1536×864, a card with an assignee and no linked issue is at most 120 px tall (today about 200 px).
- **SC-003**: At 1536×864, a column shows at least four cards without scrolling.
