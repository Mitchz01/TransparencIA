# Feature Specification: 011 · Compact task panel

**Created**: 2026-10-23  
**Status**: Draft  
**Owner**: Mitchz01  
**Reviewer**: codigotpx  
**Use cases**: UC-08 to UC-10 ([plan/use-cases.md](../../plan/use-cases.md))  

## Scope

- **Includes**: how a card opens on the board (spec 009, User Story 3): what the panel shows, how each field is edited and when changes are saved. It replaces the current panel, which looks like a settings form: boxed inputs, four large selects and a "Save changes" button.
- **Doesn't include**: new task data or new endpoints. The panel edits the same fields as today (title, description, status, assignee, priority, points, checklist) through the same contract (spec 003).
- **Doesn't include**: creating or deleting tasks, comments, or fields the board doesn't have yet (dates, labels).

## User Scenarios & Testing *(mandatory)*

The reference is a document-style page such as Notion: the title is big text, the properties are short rows with a label and a value, and the text below is read, not filled in. Editing happens where the value is, and it saves by itself.

### User Story 1 - Read a task at a glance (Priority: P1)

A member opens a card and sees, without scrolling on a laptop: the key, epic and type; the title; one short row per property (status, assignee, priority, points and, if it exists, the GitHub issue); then the description, the checklist and the acceptance criteria.

**Why this priority**: most of the time a card is opened to read it. A screen full of form controls makes reading slow and suggests that something has to be filled in.

**Independent Test**: on the fake service, open "Set up repo and CI" and check that the properties appear as label and value rows, that no boxed input or save button is visible until a value is clicked, and that the checklist is visible without scrolling at 1440×900.

**Acceptance Scenarios**:

1. **Scenario**: Properties as rows
   - **Given** a task in progress, high priority, 2 points, unassigned
   - **When** the member opens it
   - **Then** they see the rows "Estado: En curso", "Responsable: Sin asignar", "Prioridad: Alta" and "Puntos: 2 pts", each value as a word (and an icon where the design system asks for one), with no boxed fields

2. **Scenario**: Text that reads as text
   - **Given** a task with a description
   - **When** the member opens it
   - **Then** the title and the description show as plain text; a field only appears when the member clicks or focuses them

3. **Scenario**: Empty description
   - **Given** a task without a description
   - **When** the member opens it
   - **Then** a quiet "Agrega una descripción" invites them to write one

4. **Scenario**: Linked issue
   - **Given** a task published as issue #12
   - **When** the member opens it
   - **Then** an "Issue" row shows #12 with a link to GitHub

---

### User Story 2 - Edit in place, saved automatically (Priority: P1)

The member changes a value where it is: a property opens a short list of choices, the title and the description become editable when clicked, and the points accept a number. Every change is saved when it's made, and the panel says so ("Guardando", then "Guardado"). There is no save button.

**Why this priority**: it's what makes the panel feel light. Today changing the priority takes three steps (open the select, pick, press save) and closing without saving silently loses the change.

**Independent Test**: on the fake service, change the priority of a card from the panel, close it without pressing anything and reopen it: the new priority is there, and the card on the board shows it too.

**Acceptance Scenarios**:

1. **Scenario**: Pick a value
   - **Given** an open task with priority "Alta"
   - **When** the member clicks the priority and picks "Media"
   - **Then** the row shows "Media", the panel says "Guardado" and the card on the board changes too

2. **Scenario**: Edit the title
   - **Given** an open task
   - **When** the member clicks the title, changes it and presses Enter or leaves the field
   - **Then** the new title is saved; pressing Escape instead puts the previous title back without saving

3. **Scenario**: Edit the description
   - **Given** an open task
   - **When** the member writes in the description and leaves the field
   - **Then** the description is saved

4. **Scenario**: Close while editing
   - **Given** the member is typing a new title
   - **When** they close the panel before leaving the field
   - **Then** what they typed is saved, never lost

5. **Scenario**: Invalid value
   - **Given** an open task
   - **When** the member enters 150 points, or leaves the title empty
   - **Then** nothing is saved, the field stays open with what they typed and the error shows under it ("Entre 0 y 100.", "Entre 1 y 200 caracteres.")

6. **Scenario**: Saving fails
   - **Given** the service is unavailable
   - **When** the member changes a value
   - **Then** a message says it couldn't be saved, with a retry, and the panel doesn't claim "Guardado"

7. **Scenario**: Only with the keyboard
   - **Given** the panel is open
   - **When** the member moves with Tab
   - **Then** they reach the title, each property, the description and the checklist in that order, and they can change each value with Enter and the arrow keys

---

### User Story 3 - Warnings where they matter (Priority: P2)

The warnings that the board already raises stay in the panel, but inside the value they affect: a task whose role nobody has says so in its "Responsable" row, and a task in progress with its checklist complete offers to move to review.

**Why this priority**: the warnings are useful, but today the missing-role notice is a large block that pushes the content down.

**Independent Test**: open a task with `missing_role` "DevOps" and check that the "Responsable" row says "Falta DevOps" and that assigning someone makes it go away.

**Acceptance Scenarios**:

1. **Scenario**: Missing role
   - **Given** an unassigned task that needs the DevOps role, which nobody on the team has
   - **When** the member opens it
   - **Then** the "Responsable" row shows "Falta DevOps" as icon plus word, instead of a separate block

2. **Scenario**: Assigning clears it
   - **Given** that same task
   - **When** the member assigns it to Ana
   - **Then** the row shows Ana and the warning is gone

3. **Scenario**: Ready for review
   - **Given** a task in progress
   - **When** the member checks the last checklist item
   - **Then** the panel offers "Mover a revisión", as it does today

---

### Edge Cases

- What if two fields are changed quickly one after the other? Each change is sent with only its own field, in order; the panel shows "Guardando" until the last one finishes.
- What if the board changes the task while the panel is open (a move from another tab, a replan)? The properties show the new values; a field being typed in keeps what the member typed.
- What if the title is very long? It wraps in full in the panel; cards keep cutting it with an ellipsis (spec 009).
- What if the project has no members? The "Responsable" list shows only "Sin asignar".
- What if the screen is 360 px wide? The panel takes the full width, and labels and values stay on one row each.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The panel MUST show, in this order: the key, epic and type; the title; one row per property (status, assignee, priority, points, and the issue when it exists); the description; the checklist; the acceptance criteria.
- **FR-002**: Each property row MUST show a label and its value as text; the value becomes an editable control only when the member activates it.
- **FR-003**: Each change MUST be saved on its own, with only the changed field, as soon as it's made (choice picked, Enter, or leaving the field). The panel MUST NOT have a save button.
- **FR-004**: Closing the panel while a text field is being edited MUST save what was typed, if it's valid.
- **FR-005**: Escape in a text field MUST put the saved value back and leave the field; a second Escape closes the panel.
- **FR-006**: The panel MUST validate the same rules as the service before sending (spec 009, FR-008); an invalid value is not sent, keeps what was typed and shows the error under the field.
- **FR-007**: The panel MUST say "Guardando" while a change is being saved and "Guardado" once all of them are saved, as icon plus word; a failed save shows the error message with a retry and never "Guardado".
- **FR-008**: The missing-role warning MUST appear in the "Responsable" row; the checklist-complete suggestion MUST stay as it is today.
- **FR-009**: Everything MUST work with the keyboard and follow the design system (spec 009, FR-002, FR-009 to FR-011).

### Key Entities

- **Task**: the same task of spec 003. No new fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Changing a task's priority, assignee or status takes 2 clicks from the open panel (today it takes 3, plus remembering to save).
- **SC-002**: At 1440×900, the title, all property rows and the start of the checklist are visible without scrolling.
- **SC-003**: No change made in the panel is lost when it's closed.
