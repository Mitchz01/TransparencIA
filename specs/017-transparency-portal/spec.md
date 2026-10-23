# Feature Specification: Public transparency portal

**Created**: 2026-10-23  

The executing entity (the contractor that quoted and runs a public project) keeps managing it with the
project manager it already has: the agents plan it, the team works the board sprint by sprint. This
feature adds the module where **anyone can see the activities done and the money used over the life of
the project**: the contracting entity, the citizens who pay for it with their taxes, and citizen
oversight groups (Ley 850 de 2003, Ley 1712 de 2014).

Pitch: "SECOP tells you how much was signed; we show you what was done with that money."

Demo case: a foundation restores 5 ha of mangrove in the Ciénaga Grande de Santa Marta for Corpamag,
COP 180,000,000, 6 months. The foundation plans it in the app and works it on the board; Corpamag and
any citizen follow it from a QR code.

Actors:
- **Executing entity** (the foundation): the project's leader and members, signed in. Sets the budget,
  registers expenses with their evidence, publishes the portal, answers alerts.
- **Public** (Corpamag, citizens, oversight groups): opens the portal from a link or QR, no account.

Credibility rules (they shape every story):
- Percentages and the traffic light are **computed by rules**, never by the AI. The AI only reads
  documents and explains.
- The AI **never accuses**: it flags inconsistencies for a person to review.
- Nothing the AI reads is published until a person confirms it. Alerts can't be hidden by the executing
  entity: it can only answer them, publicly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project budget (Priority: P1)

The leader adds the contract's money to an existing project: contracting entity, contractor, contract
value, start date, and the budget lines (rubros) with their amounts. The end date follows from the
project's duration.

**Why this priority**: without the budget there's nothing to compare the spending against.

**Independent Test**: add the mangrove budget to a planned project and check the totals.

**Acceptance Scenarios**:

1. **Scenario**: Set the budget
   - **Given** a planned project and its leader
   - **When** they enter Corpamag, the foundation, COP 180,000,000, the start date and 4 budget lines
   - **Then** the budget is saved and shows the sum of the lines against the contract value
2. **Scenario**: Lines don't add up
   - **When** the lines add up to less than the contract value
   - **Then** the difference shows as "sin asignar", and the budget can still be saved
3. **Scenario**: Only the leader
   - **Given** a member who isn't a leader
   - **Then** they see the budget but can't change it

---

### User Story 2 - Expenses with evidence, with alerts (Priority: P1)

A team member uploads an invoice, a field photo or a report. The AI reads it and proposes what it is,
its amount, date, supplier and concept, the budget line and the board task it belongs to, a one-sentence
summary for citizens, and any inconsistencies. The member reviews it and confirms it. On confirming, the
rules check the amount against what's left in the budget line and the date against the contract period,
and add their own alerts.

**Why this priority**: it's the heart of the module: money spent, tied to the work it paid for.

**Independent Test**: upload a hardware-store invoice for mangrove seedlings (no alerts) and a
restaurant invoice (alert: the concept doesn't match "plántulas de mangle"), confirm both and check the
expenses and alerts.

**Acceptance Scenarios**:

1. **Scenario**: Invoice that fits
   - **Given** a project with a budget
   - **When** a member uploads an invoice for mangrove seedlings
   - **Then** they see a draft with amount, date, supplier and concept, assigned to the seedlings line
     and to the board task "Comprar plántulas", with no alerts
2. **Scenario**: Invoice that doesn't fit
   - **When** they upload a restaurant invoice
   - **Then** the draft carries an alert explaining that the concept doesn't match the budget line,
     worded as something to review, never as an accusation
3. **Scenario**: Rule alerts
   - **Given** a budget line with COP 2,000,000 left
   - **When** an expense of COP 3,000,000 on that line is confirmed, or one dated outside the contract period
   - **Then** a rule alert is added ("supera lo disponible en el rubro", "fecha fuera del contrato"),
     shown apart from the AI's alerts
4. **Scenario**: Field photo of an activity
   - **When** a member uploads a field photo
   - **Then** it has no amount, it's tied to a board task as evidence of that activity, and if it
     doesn't show the task's activity it carries an alert
5. **Scenario**: Nothing is public until confirmed
   - **Given** a draft
   - **Then** it doesn't appear in the portal or count in any number until it's confirmed; a draft can
     be discarded

---

### User Story 3 - Public portal by QR (Priority: P1)

The leader publishes the project's portal and gets a link and a QR code. Anyone who opens it, on their
phone and without an account, sees: the project and its parties; a traffic light comparing physical
progress, money spent and time elapsed, with why it has that color; the timeline of the project week by
week, with the activities completed and the money spent in each week; the budget lines with spent and
available amounts; the evidence with photos and its citizen summary; and the alerts with their answers.

**Why this priority**: it's the module itself, and the moment of the demo the jury touches with their phone.

**Independent Test**: publish the seeded project, open the link on a phone and check every number
against the board and the confirmed expenses.

**Acceptance Scenarios**:

1. **Scenario**: Traffic light
   - **Given** 40% of the money spent and 25% of the planned work done
   - **When** someone opens the portal
   - **Then** they see the three percentages, the traffic light and the reason in plain words
     ("se ha gastado 15 puntos más de lo que se ha avanzado")
2. **Scenario**: Activities and money over time
   - **Then** the portal shows, for each week since the start, the tasks completed that week and the
     money spent that week, and how both have accumulated against the total
3. **Scenario**: Evidence
   - **Then** confirmed evidence is listed newest first with its photo or document, date, amount,
     budget line, the activity it belongs to and its citizen summary
4. **Scenario**: Unpublish
   - **When** the leader unpublishes the portal
   - **Then** the link stops working; publishing again keeps the same link
5. **Scenario**: Unknown link
   - **When** someone opens a link that doesn't exist or isn't published
   - **Then** they see "este proyecto no existe o no es público"

---

### User Story 4 - Citizen chat (Priority: P2)

In the portal, a citizen asks a question ("¿en qué se gastaron la plata?") and gets a short answer in
plain Spanish, using only the portal's data, with amounts in Colombian pesos.

**Why this priority**: the most memorable part of the demo, but the portal already answers the question
without it. First thing to cut if time runs out.

**Independent Test**: ask three questions on the seeded project, including one the data doesn't cover.

**Acceptance Scenarios**:

1. **Scenario**: Answer from the data
   - **When** a citizen asks "¿en qué se gastaron la plata?"
   - **Then** they get at most 3 sentences that match the budget lines and expenses shown in the portal
2. **Scenario**: Data that isn't there
   - **When** they ask something the data doesn't cover
   - **Then** the answer says it hasn't been reported yet

---

### User Story 5 - The executing entity answers alerts (Priority: P2)

The leader sees every alert and writes a public answer ("la factura se cargó al rubro equivocado; se
reclasificó a logística"). The portal shows the answer under the alert.

**Why this priority**: it closes the loop of "the AI flags, a person explains". Second thing to cut.

**Independent Test**: answer the restaurant alert and check the portal.

**Acceptance Scenarios**:

1. **Scenario**: Answer
   - **Given** an alert
   - **When** the leader answers it
   - **Then** the portal shows the answer under it; the alert stays visible and still counts in the
     traffic light (the executing entity can't clear its own alerts)

---

### User Story 6 - Plans for any kind of project (Priority: P1)

The planning agents plan the project the executing entity actually runs (field work, restoration,
community work), not only software: tasks, roles and sprints that match the description.

**Why this priority**: the demo project is a mangrove restoration; a plan with "backend" tasks breaks the
story in front of the jury.

**Independent Test**: plan the mangrove project from its description and check that no task, role or
sprint talks about software.

**Acceptance Scenarios**:

1. **Scenario**: Field project
   - **When** the leader plans "Restauración de 5 ha de manglar en la Ciénaga Grande, 6 meses"
   - **Then** the board has tasks like site diagnosis, nursery, planting, monitoring and community
     workshops, and roles like biologist or field coordinator

---

### User Story 7 - The project starts from the contract (Priority: P2)

The leader uploads the signed contract (a public works contract, a service, a restoration, anything) as
a PDF. The AI reads it and drafts the project: a short name, the contract's purpose, the parties, the
value, the start and end dates, the budget lines with their amounts, the obligations and deliverables,
and the milestones with their dates. The leader reviews and fixes the draft and confirms it. That creates
the project with its duration and its budget in one step, and the planning agents plan it from the
contract's purpose, obligations and milestones. **The team and its roles are not read from the
contract**: the leader forms the team as today, from the Equipo screen and the invitation link.

**Why this priority**: it turns moment 1 of the demo into "I upload the contract and the project builds
itself". The module works without it (the budget can be typed in), so it comes after US1–US3.

**Independent Test**: upload the demo contract PDF, confirm the draft, check the project's duration and
budget, and plan it: the epics follow the contract's deliverables.

**Acceptance Scenarios**:

1. **Scenario**: Draft from a contract
   - **Given** a signed-in user
   - **When** they upload the mangrove contract PDF
   - **Then** they see an editable draft with the name, purpose, Corpamag and the foundation,
     COP 180,000,000, the start and end dates, the 4 budget lines, the obligations and the milestones
2. **Scenario**: Missing data stays missing
   - **Given** a contract that doesn't state an amount for a budget line
   - **Then** that amount is empty and marked "no aparece en el contrato"; the AI never invents amounts
3. **Scenario**: Confirm
   - **When** the leader confirms the draft
   - **Then** the project exists with them as its only member and leader, its duration in weeks
     follows from the dates, its budget is set, and planning can start
4. **Scenario**: The plan follows the contract
   - **When** the project is planned
   - **Then** every milestone of the contract shows up in the plan before its date

---

### User Story 8 - Find a public project (Priority: P2)

Anyone opens the portal's home, with no account, and searches the published projects by name, contracting
entity, contractor or what they're about. Each result shows its traffic light, the money used against the
work done, and its open alerts, and opens the project's portal.

**Why this priority**: a citizen who doesn't have the QR still has to find the project; it's the portal's
front door.

**Independent Test**: publish two projects, search "Corpamag" and "manglar", and open a result.

**Acceptance Scenarios**:

1. **Scenario**: Search
   - **When** someone types "manglar" on the portal's home
   - **Then** they see the published projects that mention it, each with its traffic light, money used,
     work done and open alerts, and opening one shows its portal
2. **Scenario**: Only published
   - **Then** projects that aren't published never appear
3. **Scenario**: Nothing found
   - **When** nothing matches
   - **Then** they see that no public project matches, and can clear the search

---

### Edge Cases

- A file that isn't a PDF or an image, or is larger than 10 MB: rejected with a clear message.
- The AI can't read the document or fails: the member sees "no pudimos leer el documento", can retry or
  fill the expense by hand, and nothing is saved until they confirm.
- A project with no tasks: physical progress shows "sin actividades planeadas" instead of 0%.
- A project with no budget: the portal can't be published.
- Spending above the contract value: the traffic light is red and the bar shows more than 100%.
- An expense the AI can't assign: it stays unassigned with an alert; the member assigns it before
  confirming.
- A task linked to evidence is deleted from the board: the evidence keeps the task's title.
- A contract without dates: the draft asks for them; the project can't be created without a start date
  and a duration.
- A contract whose text doesn't fit what the agents read (very long annexes): the obligations and
  milestones are kept, the rest is cut, and the leader can edit the description.
- Without an AI key (mock mode): the demo evidence comes back with fixed, realistic data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The leader MUST be able to set a project's budget: contracting entity, contractor, contract
  value, start date and budget lines (name, amount). The end date is the start date plus the project's
  duration.
- **FR-002**: Members MUST be able to upload evidence (PDF or image) and get an editable draft: kind
  (invoice, field photo, report), amount, date, supplier, concept, budget line, board task, citizen
  summary and alerts.
- **FR-003**: The AI MUST leave empty what the document doesn't state and MUST NOT invent amounts.
- **FR-004**: The AI MUST flag, with a level (high, medium, low) and a reason: a concept that doesn't
  match its budget line, and a photo that doesn't show its task's activity. Reasons MUST describe the
  inconsistency for human review and MUST NOT accuse anyone.
- **FR-005**: On confirming, the rules MUST add alerts when the amount exceeds what's left in its budget
  line (high) or the date is outside the contract period (medium). Rule alerts and AI alerts MUST be
  told apart.
- **FR-006**: Only confirmed evidence MUST count in the numbers and appear in the portal.
- **FR-007**: The rules MUST compute: money spent and its share of the contract value; spent and
  available per budget line; physical progress as done task points over all task points; time elapsed
  as days since the start over the contract's days.
- **FR-008**: The rules MUST compute the traffic light, with its reasons in plain words: red if there is
  a high alert, spending exceeds the contract value, or spending is more than 25 points ahead of physical
  progress; yellow if there is a medium alert, spending is more than 10 points ahead of physical progress,
  or time elapsed is more than 20 points ahead of physical progress; green otherwise.
- **FR-009**: The rules MUST compute the weekly timeline from the start date to today (or the end date):
  per week, the tasks completed and the money spent, and the accumulated physical progress and spending.
- **FR-010**: The leader MUST be able to publish and unpublish the portal; publishing gives a link that is
  hard to guess, stable across republishing, and a QR code for it.
- **FR-011**: The portal MUST work without an account and on a phone screen, and MUST show the parties,
  the traffic light and its reasons, the three percentages, the weekly timeline, the budget lines, the
  evidence and the alerts with their answers.
- **FR-012**: The portal MUST NOT show the team's private data (emails, hours, internal comments) nor
  drafts.
- **FR-013**: The citizen chat MUST answer only from the portal's data, in at most 3 sentences, in
  Spanish, with amounts in Colombian pesos, and MUST say when something hasn't been reported.
- **FR-014**: The leader MUST be able to answer an alert publicly; alerts can't be deleted or hidden.
- **FR-015**: The planning agents MUST plan any kind of project from its description, not only software.
- **FR-016**: The GitHub integration and the generated software specs and diagrams MUST be hidden from
  navigation and MUST NOT run.
- **FR-017**: The demo seed MUST create the mangrove project planned, with work done on the board over
  several weeks, its budget, 3 confirmed pieces of evidence (one with an open alert) and the portal
  published, so the demo works even if the AI is down.
- **FR-018**: A signed-in user MUST be able to upload a contract PDF and get an editable draft: name,
  purpose, contracting entity, contractor, value, start and end dates, budget lines, obligations and
  milestones (name, date, deliverable). The AI MUST leave empty what the contract doesn't state.
- **FR-019**: The AI MUST NOT read the team, its roles or its people from the contract; the leader forms
  the team.
- **FR-020**: Confirming the draft MUST create, in one step, the project (the person as its leader, the
  duration in weeks from the dates) and its budget; if any part fails, nothing is created.
- **FR-021**: The planning agents MUST see the contract's purpose, obligations and milestones with their
  dates, and plan the milestones before their dates.
- **FR-022**: The portal's home MUST list the published projects, searchable by name, description,
  contracting entity and contractor (ignoring case and accents), with each one's traffic light, money used,
  work done and open alerts, computed by the same rules as its portal.

### Key Entities

- **Budget**: of a project; contracting entity, contractor, contract value, start date, budget lines.
- **Budget line (rubro)**: name and amount.
- **Expense / evidence**: the uploaded file, kind, amount, date, supplier, concept, budget line, the
  board task it belongs to, citizen summary, status (draft or confirmed).
- **Alert**: level, reason, source (AI or rule), the executing entity's answer; belongs to an evidence.
- **Portal publication**: of a project; public or not, its stable link.
- **Activity**: the board's tasks (already exist); this feature needs to know when each one was done.
- **Contract reading** (US7): the AI's draft of a project from its contract (name, purpose, parties,
  value, dates, budget lines, obligations, milestones); it isn't kept once the project is created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From uploading an invoice to seeing it in the portal takes under 1 minute.
- **SC-002**: A juror who scans the QR understands the project's status (traffic light and why) in under
  10 seconds, without help.
- **SC-003**: Every number in the portal can be recomputed by hand from the board and the confirmed
  expenses.
- **SC-004**: The restaurant invoice charged to "plántulas de mangle" is flagged on every run of the demo.
- **SC-005**: The full demo runs in under 3 minutes, with and without the AI available.

## Out of scope (for the hackathon)

- Accounts for the contracting entity (it follows the public portal like everyone else); supervisor
  (interventoría) sign-off on activities or alerts.
- Reading the budget from a quote (only from the contract, US7); contract annexes beyond the obligations
  and milestones.
- Pulling contracts from SECOP; contract changes (otrosíes, adiciones).
- Rate limiting the public chat.
