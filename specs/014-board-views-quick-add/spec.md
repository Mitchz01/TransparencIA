# Feature Specification: 014 · Board views, filters and quick add

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: UC-05, UC-06 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: how the board screen is organized (spec 009, User Story 3, after spec 013): a toolbar with the view (board or list) and one "Filtrar" button, the team in the header, a list view of the same tasks, and adding a task from a column.
- **Includes**: a color per column (a dot in the column name and a tinted panel), which changes the design system rule against status dots for this one place.
- **Includes**: while a card is dragged, the column under it makes room where the card will land.
- **Includes**: creating a task in the service (spec 003 had no way to create one outside the plan or a replan): a new endpoint and a new event.
- **Doesn't include**: a wide sidebar (the icon rail stays, spec 009 FR-001), deleting tasks, new task fields, or new views besides the list (the timeline is the roadmap in the plan, spec 012).
- **Already there**: "Todos los proyectos" and "Nuevo proyecto" live in the project switcher of the top bar.

## User Scenarios & Testing *(mandatory)*

The reference is a project board such as the "One Agency" Dribbble shot: the project and its people at the top, the views as tabs, filters behind one button, and "Add new" at the bottom of each column.

### User Story 1 - Add a task where it goes (Priority: P1)

A member sees something missing in the sprint and adds it right in the column where it belongs: they write the title, press Enter, and the card is there. They can keep adding more without leaving the column.

**Why this priority**: today the only tasks are the ones the agents planned. Real sprints get bugs and small chores that nobody planned, and the team has to be able to put them on the board.

**Independent Test**: on the fake service, in "Por hacer" of Sprint 1, add "Revisar textos del checkout" and see the card at the bottom of the column with a new key; reload and it's still there.

**Acceptance Scenarios**:

1. **Scenario**: Add from a column
   - **Given** Sprint 1 is open on the board
   - **When** the member presses "Agregar tarea" at the bottom of "Por hacer", writes "Revisar textos del checkout" and presses Enter
   - **Then** a card with that title and the next free key (for example "US-13") appears at the end of the column, in Sprint 1, with medium priority, 1 point and no one assigned, and the field stays open, empty, for the next one

2. **Scenario**: Cancel
   - **Given** the field is open
   - **When** the member presses Escape, or leaves the field empty
   - **Then** the field closes and nothing is created

3. **Scenario**: Invalid title
   - **Given** the field is open
   - **When** the member writes more than 200 characters and presses Enter
   - **Then** nothing is created, the text stays and "Entre 1 y 200 caracteres." shows under the field

4. **Scenario**: Filters are kept
   - **Given** the board is filtered by Ana and high priority
   - **When** the member adds a task
   - **Then** the new task is assigned to Ana with high priority, so it doesn't disappear from the filtered board

5. **Scenario**: Closed sprint
   - **Given** Sprint 1 is closed
   - **When** the member looks at its columns
   - **Then** there's no "Agregar tarea"

6. **Scenario**: Everyone sees it
   - **Given** two members have the board open
   - **When** one of them adds a task
   - **Then** it appears on the other's board and in the activity, as any other change

---

### User Story 2 - Filters behind one button (Priority: P1)

The filters (responsable, épica, prioridad) live in a panel that opens from one "Filtrar" button. The button says how many filters are on, and a quiet "Quitar filtros" next to it clears them.

**Why this priority**: three dropdowns and three chips take a full row above the columns and are noise when nobody is filtering, which is most of the time.

**Independent Test**: open "Filtrar", pick Ana and "Alta", close the panel: the button says "Filtrar 2", the address has both filters, and only Ana's high priority cards are left.

**Acceptance Scenarios**:

1. **Scenario**: Pick filters
   - **Given** no filters
   - **When** the member opens "Filtrar" and picks the responsable "Ana" and the priority "Alta"
   - **Then** the board shows only those cards and the button reads "Filtrar" with a "2"

2. **Scenario**: Clear
   - **Given** two filters on
   - **When** the member presses "Quitar filtros"
   - **Then** every card is back and the button shows no number

3. **Scenario**: Keyboard
   - **Given** the focus is on "Filtrar"
   - **When** the member presses Enter, moves with Tab, picks with Space or Enter and presses Escape
   - **Then** the panel opens, each option can be pressed, and Escape closes it with the focus back on the button

---

### User Story 3 - The board or a list of the same tasks (Priority: P2)

Next to the filters, two tabs switch between "Tablero" and "Lista". The list shows the same tasks of the sprint, with the same filters, one row per task grouped by column: key, title, responsable, priority, points and checklist. A row opens the task panel.

**Why this priority**: to review a sprint (planning, the daily), a list is faster to scan than four columns; but the board already covers the work, so the list comes after.

**Independent Test**: switch to "Lista": the sprint's tasks appear in groups "Por hacer", "En curso", "En revisión", "Hecho"; pressing a row opens its panel; the address says `view=list`, so reloading keeps the list.

**Acceptance Scenarios**:

1. **Scenario**: Rows grouped by column
   - **Given** Sprint 1 with tasks in three columns
   - **When** the member picks "Lista"
   - **Then** each column with tasks is a group with its name and count, and each task a row with its key, title, responsable, priority (icon plus word), points and checklist progress

2. **Scenario**: Open from a row
   - **Given** the list
   - **When** the member presses a row, or focuses it and presses Enter
   - **Then** the task panel opens, as from a card

3. **Scenario**: Narrow screen
   - **Given** a 360 px screen
   - **When** the member opens the list
   - **Then** each row keeps the title, key and priority; the rest of the data hides

---

### User Story 4 - Who's on the team, at a glance (Priority: P3)

The board header shows the initials of the team members next to the sprint actions, up to four and then "+N". They lead to the team in the project settings.

**Why this priority**: it gives context (who works on this) and a shortcut to the team, but nothing depends on it.

**Independent Test**: on "Tienda online" the header shows the members' initials; a screen reader reads "Equipo: Marta, Pablo, Sara y 2 más"; pressing it opens the settings.

**Acceptance Scenarios**:

1. **Scenario**: Many members
   - **Given** a team of six
   - **When** the member opens the board
   - **Then** the header shows four sets of initials and "+2"

---

### User Story 5 - Each column has its color (Priority: P2)

Every column has a hue: "Backlog" and "Por hacer" neutral, "En curso" blue, "En revisión" amber, "Hecho" teal. The column name sits in a small label with a dot of that hue, and the column panel takes a soft tint of it, so the board can be read by color from afar, as in Notion. The name is always written next to the dot.

**Why this priority**: the team reads progress by where the cards are; with every column the same grey, the split between work started, in review and done has to be read word by word.

**Independent Test**: on the board, "En curso" has a blue dot and a blue tinted panel and "Hecho" a teal one; in the dark theme the cards still stand apart from the tinted panels; the list view uses the same labels for its groups.

**Acceptance Scenarios**:

1. **Scenario**: Column colors
   - **Given** a sprint on the board
   - **When** the member looks at the columns
   - **Then** each column label shows a dot in its hue next to its name, and its panel has that hue's tint; neutral columns keep the grey panel

---

### User Story 6 - The column makes room for the card (Priority: P2)

While a member drags a card, the column under the pointer opens a gap where the card will land, and the cards below move down to make room; the column it left closes its gap. Dropping puts the card exactly in that gap. Escape puts everything back.

**Why this priority**: today the target column only changes color, so the member can't see where in the column the card will end up until they drop it.

**Independent Test**: drag "Definir el modelo de datos" from "En curso" over the second card of "Hecho": a gap opens above that card and "En curso" closes up; drop it and it stays second in "Hecho".

**Acceptance Scenarios**:

1. **Scenario**: A gap where it will land
   - **Given** a card being dragged from "En curso"
   - **When** the pointer passes over the second card of "Hecho"
   - **Then** "Hecho" opens a gap of the card's size above that card, and "En curso" closes the space the card left

2. **Scenario**: An empty column
   - **Given** a card being dragged
   - **When** the pointer passes over an empty column
   - **Then** the column shows the gap at the top instead of "Suelta una tarea aquí"

3. **Scenario**: Cancel
   - **Given** a card being dragged over another column
   - **When** the member presses Escape or drops it outside the board
   - **Then** every card goes back to where it was and nothing is saved

---

### Edge Cases

- What if two members add a task at the same time? Each gets its own key; keys are never reused, even after a replan discards a task.
- What if the project's keys aren't "US-N" (a replan added "BUG-3")? The next key is "US-" plus one more than the highest "US-N" number.
- What if the board is continuous (Kanban)? Tasks are added to the whole board; there's no sprint.
- What if the list has no tasks after filtering? It says so and offers "Quitar filtros", like the board.
- What if the service fails while adding? The text stays in the field and a message offers to retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every column of an open sprint (or of a continuous board) MUST offer "Agregar tarea", which opens a title field at the end of the column.
- **FR-002**: Enter MUST create the task with that title in that column and sprint, at the end; the field MUST stay open and empty for the next one. Escape, or leaving it empty, closes it without creating anything.
- **FR-003**: A new task MUST get the next free "US-N" key of the project, medium priority, 1 point, `feature` type, no epic and no checklist, unless the request says otherwise; the board's active filters (responsable, priority, epic) MUST be applied to it.
- **FR-004**: The service MUST validate a new task with the same rules as an edit (spec 003): title 1–200 characters, points 0–100, a sprint and a member of the project; adding to a closed sprint is refused.
- **FR-005**: Creating a task MUST publish an event that updates every open board and the activity feed, and MUST reopen a met sprint objective (spec 008), since the sprint has work again.
- **FR-006**: The filters MUST live in a panel opened by one "Filtrar" button that shows how many are on; "Quitar filtros" MUST appear next to it when any is on. The filters stay in the address (spec 003, US5).
- **FR-007**: The board MUST offer a "Tablero" / "Lista" switch; the choice MUST live in the address (`view=list`). The list MUST use the same tasks and filters as the board and open the task panel from a row.
- **FR-008**: The board header MUST show the team's initials (up to four, then "+N"), with an accessible name that lists them, leading to the project settings.
- **FR-010**: Each column MUST have a hue (neutral for backlog and to do, blue in progress, amber in review, teal done) shown as a dot inside its name label and as a tint of its panel; the name is always written, so color never carries the meaning alone (spec 009, FR-009), and every text on a tinted panel meets 4.5:1 in both themes.
- **FR-011**: While a card is dragged, the column under it MUST open a gap where the card would land and the source column MUST close its gap; the drop MUST land in that gap, and a cancelled drag MUST leave the board as it was.
- **FR-009**: Everything MUST work with the keyboard and follow the design system (spec 009, FR-002, FR-009 to FR-012).

### Key Entities

- **Task**: the same task of spec 003. No new fields; it can now be created by a person.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding three tasks to a column takes three titles and three Enter presses, with no other click after the first.
- **SC-002**: With no filters on, the row between the header and the columns holds only the view switch and "Filtrar" (today three dropdowns and three chips).
- **SC-003**: The list shows the whole sprint of "Tienda online" at 1536×864 without scrolling.
