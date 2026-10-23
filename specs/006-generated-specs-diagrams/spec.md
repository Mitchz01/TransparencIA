# Feature Specification: 006 · Generated specs and diagrams

**Created**: 2026-10-23  
**Status**: Approved  
**Owner**: Mitchz01  
**Reviewer**: sandredev  
**Use cases**: UC-08 ([plan/use-cases.md](../../plan/use-cases.md))  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - General product spec (Priority: P1)

When the last stage of the plan (sprints) is approved, a writer agent produces the **general product spec**: problem, users, goals, scope, main stories and success criteria. It builds it from the approved plan and proposes it to the leader like any other agent decision.

**Why this priority**: it's the document that gives the team the most value to get started, and it makes the product apply the same practice (specs before code) that it recommends.

**Independent Test**: approve a full plan and verify that a general spec proposal shows up that can be read, approved and later browsed as a project document.

**Acceptance Scenarios**:

1. **Scenario**: Generated when the plan closes
   - **Given** a project that only needs the sprints stage approved
   - **When** the leader approves it
   - **Then** the UI shows that the writer is working and a general spec proposal appears

2. **Scenario**: Approval creates the document
   - **Given** a pending general spec proposal
   - **When** the leader approves it
   - **Then** a "General spec" document exists at version 1, visible in the project

---

### User Story 2 - Specs per epic (Priority: P2)

Besides the general one, the writer produces one spec per roadmap epic. Each one describes its stories with acceptance criteria, edge cases and requirements, so whoever picks up those tasks has the detail.

**Why this priority**: it's what the team uses day to day, but the general spec is enough to show the feature.

**Independent Test**: with a 5-epic roadmap, verify that 5 specs are proposed and that each one names the stories of its epic.

**Acceptance Scenarios**:

1. **Scenario**: One spec per epic
   - **Given** an approved plan with 5 epics
   - **When** spec generation finishes
   - **Then** there are 5 spec proposals, one per epic, each with that epic's stories and acceptance criteria

---

### User Story 3 - Flow diagrams (Priority: P2)

The writer produces flow diagrams for the product's main journeys (for example, sign-up or checkout) and a diagram of the approved architecture. The diagrams are rendered inside the tool and can also be copied to GitHub, where they render the same.

**Why this priority**: it has a big visual impact in the demo, although it isn't essential to work.

**Independent Test**: approve the plan, open the proposed diagrams and verify that all of them render without errors.

**Acceptance Scenarios**:

1. **Scenario**: Valid diagrams
   - **Given** an approved plan
   - **When** diagram generation finishes
   - **Then** there's at least one architecture diagram and one flow diagram per main journey, and all of them render correctly

---

### User Story 4 - Regenerate a document (Priority: P3)

The leader can ask to regenerate a document with instructions ("add the payments flow", "make it shorter"). The result arrives as a new proposal and, once approved, becomes a new version without losing the previous one.

**Why this priority**: it improves the documents' quality over time, but the demo doesn't need it.

**Independent Test**: regenerate the general spec with an instruction, approve it and verify that there's a version 2 and that version 1 is still available.

**Acceptance Scenarios**:

1. **Scenario**: New version
   - **Given** the general spec at version 1
   - **When** the leader asks to regenerate it with "add the payments flow" and approves the proposal
   - **Then** the general spec moves to version 2 with the payments flow and version 1 can still be viewed

---

### Edge Cases

- What if a generated diagram can't be rendered? Generation is retried once; if it still fails, that diagram isn't proposed and the UI says which one is missing.
- What if the roadmap has many epics (more than 10)? They're generated anyway, one proposal per epic, and the leader can approve them all at once.
- What if a spec is rejected? The same rejection rule as in spec 002 applies (FR-011).
- What if the plan changes after the documents are approved (replan, spec 008)? The affected documents are flagged as outdated and regenerating them is offered; they aren't rewritten by themselves.
- What if the leader edits a document by hand? The edit is saved as a new version, same as a regeneration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the sprints stage is approved, the system MUST generate the general spec, the per-epic specs and the diagrams, in that order.
- **FR-002**: Each generated document MUST arrive as a proposal and not exist as a project document until it's approved (constitution, principle 8). With auto-approve, it's approved by itself.
- **FR-003**: Documents MUST be built only from the final version of the approved plan and the project data.
- **FR-004**: The general spec and the per-epic specs MUST follow the same structure as this repo's specs: prioritized stories with Given/When/Then scenarios, edge cases, requirements and success criteria.
- **FR-005**: The system MUST generate one spec per epic of the approved roadmap (not per use case: the epics already exist in the plan and group their stories, so no extra stage is needed).
- **FR-006**: Each diagram MUST be checked before it's proposed; a diagram that can't be rendered isn't proposed.
- **FR-007**: Documents MUST be in a text format that renders the same in the tool and on GitHub.
- **FR-008**: When the regeneration of an existing document is approved, the system MUST create a new version and keep the previous ones.
- **FR-009**: The leader MUST be able to ask to regenerate a document with free-text instructions.
- **FR-010**: The system MUST report live which document is being generated (as in spec 002, FR-007).
- **FR-011**: If the plan changes after a document is approved, the system MUST flag that document as outdated.

### Key Entities

- **Document**: a project's general spec, epic spec or flow diagram. It has a kind, title, content, version and whether it's outdated.
- **Document version**: each approved content of a document; it's never deleted.
- **Document proposal**: a document (new, or a new version) waiting for approval. Its lifecycle is defined by spec 005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The documents of a 5-epic plan are proposed in under 2 minutes from the moment the sprints are approved.
- **SC-002**: 100% of the roadmap epics have their spec proposed.
- **SC-003**: 100% of the proposed diagrams render without errors in the tool and on GitHub.
- **SC-004**: Regenerating a document never deletes a previous version.
- **SC-005**: A member who just joined the team finds in their epic's spec the acceptance criteria of all their tasks, without asking anyone.
