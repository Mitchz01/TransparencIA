# Implementation Plan: 006 · Generated specs and diagrams

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

When the plan is completed, a writer agent proposes the general product spec, then one spec per roadmap epic, then flow and architecture diagrams in Mermaid. Each document is a `document` proposal; approving it creates a versioned `Document` (or a new version of an existing one). Documents follow this repo's spec template structure. Diagrams pass a structural Mermaid check before they're proposed (one retry), and the frontend renders them with `mermaid`, showing the source if rendering fails. The leader can regenerate a document with instructions or edit it by hand; both create new versions. A replan marks documents as outdated.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: FastAPI, Pydantic, SQLModel, Google ADK + Gemini; `mermaid` and `react-markdown` (frontend)  
**Storage**: SQLite; new `document` and `document_version` tables  
**Testing**: pytest with mock agents and a scripted fake agent for invalid diagrams; `tsc -b`  
**Target Platform**: local dev server, Cloud Run as the deployment target  
**Project Type**: web (backend + frontend)  
**Performance Goals**: documents for a 5-epic plan proposed in < 2 min after the sprints are approved (SC-001)  
**Constraints**: no document exists before its proposal is approved (constitution 8); generation runs in the background; versions are never deleted  
**Scale/Scope**: 1 general spec + 1 spec per epic (typically 3–10) + 2–5 diagrams per project

## Project Structure

### Documentation (this feature)

```text
specs/006-generated-specs-diagrams/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── domain/
│   ├── plan.py                          # + GeneralSpec, EpicSpec, FlowDiagrams schemas, DOCUMENT_STAGES
│   ├── documents.py                     # kind use_case_spec → epic_spec; + epic_key, outdated, DocumentVersion
│   ├── diagrams.py                      # NEW: check_mermaid()
│   └── events.py                        # + DocumentsGenerated
├── application/
│   ├── ports/repositories.py            # DocumentRepository: + get, find, add_version, versions
│   ├── ports/unit_of_work.py            # + documents
│   └── use_cases/
│       ├── planning/generate_documents.py
│       └── documents/apply_document.py, regenerate_document.py, edit_document.py,
│                     list_documents.py, mark_outdated.py
└── adapters/
    ├── inbound/http/documents.py        # /api/projects/{id}/documents, /api/documents/{id}
    └── outbound/
        ├── persistence/                 # DocumentTable, DocumentVersionTable, repo, UoW
        └── agents/
            ├── adk/prompts.py           # + general_spec, epic_spec, flow_diagrams, SPEC_STRUCTURE
            └── mock/data.py             # + sample documents

backend/tests/
├── unit/domain/test_diagrams.py
├── unit/application/test_generate_documents.py, test_apply_document.py, test_regenerate_document.py
└── integration/adapters/test_documents_api.py

frontend/src/
├── domain/documents.ts                  # epic_spec, versions, outdated
├── application/ports.ts                 # + DocumentGateway
├── application/use-cases/useDocuments.ts
├── adapters/http/documentGateway.ts, adapters/fake/documentGateway.ts
└── ui/
    ├── pages/DocumentsPage.tsx
    └── components/
        ├── documents/MarkdownView.tsx, VersionHistory.tsx, RegenerateDialog.tsx, DocumentEditor.tsx
        └── diagrams/MermaidView.tsx
```

**Structure Decision**: web application on the existing hexagonal layout. The document stages are declared next to `PLANNING_STAGES` as `DOCUMENT_STAGES`, so the `PlanningAgents` port and both agent adapters work unchanged; `GenerateDocuments` reuses spec 002's `RunPlanningStep` logic for agent calls, events and proposals.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: frontend dependencies

- [ ] T001 Install `mermaid` and `react-markdown` in `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schemas, document entities and persistence

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [ ] T002 In `backend/app/domain/documents.py`, rename the kind `use_case_spec` to `epic_spec`, add `epic_key: str | None`, `outdated: bool`, and the `DocumentVersion(document_id, version, content, proposal_id, created_at)` entity; mirror it in `frontend/src/domain/documents.ts`
- [ ] T003 Add `DocumentTable` and `DocumentVersionTable` with mappers, extend `DocumentRepository` (get, find(project_id, kind, epic_key), add, save, add_version, versions) and add `documents` to the `UnitOfWork` port, `SqlUnitOfWork` and `backend/tests/fakes.py`
- [ ] T004 Add the output schemas to `backend/app/domain/plan.py`: `GeneralSpec(title, markdown, rationale)`, `EpicSpec(epic_key, title, markdown, rationale)`, `FlowDiagrams(diagrams: list[Diagram(title, kind: "flow" | "architecture", mermaid)], rationale)`
- [ ] T005 Declare `DOCUMENT_STAGES` in `backend/app/domain/plan.py`: `general_spec` (inputs: project, analysis, architecture, roadmap, backlog), `epic_spec` (inputs: project, epic, stories — derived per epic), `flow_diagrams` (inputs: project, analysis, architecture, roadmap)
- [ ] T006 [P] Add the prompts to `backend/app/adapters/outbound/agents/adk/prompts.py`, with a `SPEC_STRUCTURE` constant summarizing `specs/spec-template.md` (prioritized stories, Given/When/Then, edge cases, requirements, success criteria) for FR-004
- [ ] T007 [P] Add sample outputs for the three stages to `backend/app/adapters/outbound/agents/mock/data.py`

**Checkpoint**: document stages are callable through `PlanningAgents` in mock and real mode

---

## Phase 3: User Story 1 - General product spec (Priority: P1) 🎯 MVP

**Goal**: approving the sprints stage proposes the general spec; approving it creates "General spec" v1

**Independent Test**: approve a full plan; a general spec proposal appears, and approving it creates a v1 document visible in the project

### Tests for User Story 1

- [ ] T008 [P] [US1] `GenerateDocuments` tests (runs on plan completion; `AgentStarted` + `ProposalCreated` for `general_spec`; context built only from approved finals; auto-approve applies it) in `backend/tests/unit/application/test_generate_documents.py`
- [ ] T009 [P] [US1] `ApplyDocumentProposal` tests (creates v1; nothing exists before approval) in `backend/tests/unit/application/test_apply_document.py`

### Implementation for User Story 1

- [ ] T010 [US1] Implement `GenerateDocuments` in `backend/app/application/use_cases/planning/generate_documents.py`, starting with `general_spec`; each output becomes a `document` proposal with key `general_spec`
- [ ] T011 [US1] Register `GenerateDocuments` as an `on_plan_completed` handler of spec 002's `AdvancePlanning` (after `ApplyPlan`) in `backend/app/adapters/inbound/http/dependencies.py`
- [ ] T012 [US1] Implement `ApplyDocumentProposal` in `backend/app/application/use_cases/documents/apply_document.py`: find the document by kind and epic; create it at v1 or add a new version; save the `DocumentVersion` with its proposal id
- [ ] T013 [US1] Implement `ListDocuments` and `GET /api/projects/{id}/documents` + `GET /api/documents/{id}` (with versions) in `backend/app/adapters/inbound/http/documents.py`; include the router in `main.py`
- [ ] T014 [US1] Add `DocumentGateway` (ports, http, fake), `useDocuments`, `DocumentsPage` (list + viewer) and `MarkdownView`; route `/projects/:id/documents`

**Checkpoint**: the general spec can be generated, approved and read

---

## Phase 4: User Story 2 - Specs per epic (Priority: P2)

**Goal**: one spec proposal per roadmap epic

**Independent Test**: with a 5-epic roadmap, 5 spec proposals appear, each naming its epic's stories

### Tests for User Story 2

- [ ] T015 [P] [US2] Tests: one `epic_spec:<EP-n>` proposal per epic; each agent call only receives that epic and its stories, in `backend/tests/unit/application/test_generate_documents.py`

### Implementation for User Story 2

- [ ] T016 [US2] Extend `GenerateDocuments` to loop over the approved roadmap's epics after `general_spec`, building the derived `epic` and `stories` context per epic
- [ ] T017 [US2] Group epic specs under their phase in `DocumentsPage`

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - Flow diagrams (Priority: P2)

**Goal**: an architecture diagram and flow diagrams for the main journeys, all renderable

**Independent Test**: approve the plan; open the proposed diagrams; all of them render

### Tests for User Story 3

- [ ] T018 [P] [US3] `check_mermaid` tests (allowed headers `flowchart`/`graph`/`sequenceDiagram`/`stateDiagram-v2`/`erDiagram`; non-empty body; balanced brackets and quotes; no `<script>` or HTML tags) in `backend/tests/unit/domain/test_diagrams.py`
- [ ] T019 [P] [US3] Tests: an invalid diagram is regenerated once; if it's still invalid, it isn't proposed and `DocumentsGenerated` lists it as missing, in `backend/tests/unit/application/test_generate_documents.py`

### Implementation for User Story 3

- [ ] T020 [US3] Implement `check_mermaid(source) -> list[str]` in `backend/app/domain/diagrams.py`
- [ ] T021 [US3] Extend `GenerateDocuments` with `flow_diagrams`: validate each diagram, retry once with the issues as `feedback`, propose each valid diagram as `flow_diagram:<n>`, publish `DocumentsGenerated(missing=[...])`
- [ ] T022 [US3] Create `MermaidView` (`mermaid.render` with a unique id; on parse error, show the source and a warning) and use it in `DocumentsPage`

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Regenerate a document (Priority: P3)

**Goal**: regenerate with instructions, or edit by hand; both create a new version and keep the old ones

**Independent Test**: regenerate the general spec with "add the payments flow", approve it; v2 exists and v1 is still viewable

### Tests for User Story 4

- [ ] T023 [P] [US4] `RegenerateDocument` and `EditDocument` tests (proposal with `feedback = instructions`; approved → v2; manual edit → new version without a proposal; v1 kept) in `backend/tests/unit/application/test_regenerate_document.py`
- [ ] T024 [P] [US4] `MarkDocumentsOutdated` test in `backend/tests/unit/application/test_apply_document.py`

### Implementation for User Story 4

- [ ] T025 [US4] Implement `RegenerateDocument` (background, reuses the stage run with `feedback`) and `EditDocument` (the leader's own edit is not an agent decision, so it saves a version directly) in `backend/app/application/use_cases/documents/`
- [ ] T026 [US4] Add `POST /api/documents/{id}/regenerate` (202) and `PUT /api/documents/{id}` to `backend/app/adapters/inbound/http/documents.py`
- [ ] T027 [US4] Implement `MarkDocumentsOutdated(project_id)` in `backend/app/application/use_cases/documents/mark_outdated.py`; spec 008 calls it after a replan is applied; regenerating or editing clears the flag
- [ ] T028 [US4] Create `VersionHistory`, `RegenerateDialog` and `DocumentEditor`; show an "outdated" badge with a regenerate shortcut

**Checkpoint**: all user stories work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Check SC-001 against Gemini with a 5-epic project; if it's too slow, run the epic specs concurrently with `asyncio.gather` (each one still a separate proposal)
- [ ] T030 [P] "Approve all" for a batch of document proposals is part of spec 005's proposal UI; make sure document proposals carry what it needs (kind, epic, title)
- [ ] T031 Update `plan/use-cases.md` (UC-08) if the implementation drifted

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish**

### User Story Dependencies

- **US1 (P1)**: after Foundational and spec 002's `AdvancePlanning` (handler hook)
- **US2 (P2)** and **US3 (P2)**: extend `GenerateDocuments` (US1); independent from each other
- **US4 (P3)**: needs `ApplyDocumentProposal` (US1)

### Cross-spec dependencies

- **002 → 006**: `GenerateDocuments` is an `on_plan_completed` handler and reuses `RunPlanningStep`'s agent call, retry and events.
- **005 → 006 (contract)**: when a `document` proposal is approved or adjusted, spec 005 calls `ApplyDocumentProposal(proposal_id)`; rejections follow spec 002's redo rule.
- **008 → 006**: after applying a replan, spec 008 calls `MarkDocumentsOutdated(project_id)`.
- **004**: may link the architecture diagram from the architecture view.

### Within Each User Story

- Domain schemas and checks before use cases
- Use cases before endpoints
- Endpoint before UI

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
