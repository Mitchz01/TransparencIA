# P2 — AI

You own **everything Gemini does**: reading evidence into an expense draft with alerts, the citizen chat,
and making the planning agents plan any kind of project (not only software). Plan tasks: T002, T007,
T009, T010, T021. You're the only one who needs `GOOGLE_API_KEY` before 1:30.

## Your files (only these)

- `apps/api/app/application/ports/transparency_agents.py` (signature in the [README](README.md#backend--ports-appapplicationports))
- `apps/api/app/adapters/outbound/agents/mock/transparency_agents.py`, `mock/transparency_data.py`
- `apps/api/app/adapters/outbound/agents/adk/transparency_agents.py`, `adk/transparency_prompts.py`
- `apps/api/app/adapters/outbound/agents/adk/prompts.py` (only the generalization, US6)
- `apps/api/app/application/use_cases/transparency/ask_citizen.py`
- `apps/api/demo/` (demo files)
- `apps/api/tests/integration/adapters/test_mock_transparency_agents.py`,
  `apps/api/tests/unit/application/test_ask_citizen.py`

`main.py` already wires your adapters (skeleton): `MockTransparencyAgents()` without a key,
`AdkTransparencyAgents(model=GEMINI_MODEL)` with one.

## Phase 1 (0:10–0:50)

1. **Mock first (by 0:30, P3 needs it):** `read_evidence` picks a fixture by `filename`, lowercased.
   Values are in the [README's demo project](README.md#the-demo-project-same-numbers-everywhere).
   - `restaurante`: a restaurant invoice for `2400000` charged to R1, with a `medium` alert ("El concepto
     (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión.").
   - `foto`: a field photo with no amount, R2, the task whose title contains "Sembrar".
   - Anything else: the seedlings invoice (`30000000`, R1, the task whose title contains "plántulas").
   - Pick the `task_id` from `context["tasks"]` by title, so it works with the seed's real ids.
   - `answer_citizen`: a fixed answer built from `portal["lines"]` (top 2 lines by spent, in pesos).
   - Add a short `asyncio.sleep(MOCK_AGENTS_DELAY)` so the UI's spinner shows.
2. **Prompts in AI Studio** with the real demo files, before writing the adapter.
   - Evidence: "You audit a public project. You get the budget (lines), the contract period and the
     board's tasks as JSON, and one piece of evidence (invoice, field photo or report). Fill the schema.
     Use null for anything the document doesn't state; never invent amounts. Amounts in Colombian pesos,
     as integers. Pick `budget_line_id` and `task_id` only from the given ones, else null. Alert when:
     - the concept doesn't match the budget line;
     - the photo doesn't show the task's activity;
     - the document is illegible.
     Describe the inconsistency for human review; never accuse anyone. `citizen_summary`: one simple
     sentence in Spanish."
   - Chat: "Answer a citizen's question about this public project using ONLY this data. Plain Spanish,
     at most 3 sentences, amounts in Colombian pesos. If the data doesn't have it, say it hasn't been
     reported yet."
   - Rules don't go in prompts: the traffic light and percentages are computed in code (P1). Never ask
     Gemini for a percentage.
3. **Demo files** in `apps/api/demo/`:
   - `factura-vivero.pdf`: an invoice for 20.000 plántulas (a Docs/Word document exported to PDF is fine).
   - `factura-restaurante.jpg`: a photo of a real restaurant receipt.
   - `foto-siembra.jpg`: any photo of mangrove planting.
   They must work with the real model and with the mock's filename rule.

## Phase 2 (0:50–1:30)

1. **ADK adapter**: same pattern as `adk/agents.py`.
   - One `LlmAgent` per call with `output_schema=EvidenceReading` (or `CitizenAnswer`), the instruction
     as a provider function (so ADK doesn't parse the JSON braces), and the context as JSON.
   - The file goes in the user message:
     `types.Content(role="user", parts=[types.Part(text="Read this evidence."), types.Part.from_bytes(data=file, mime_type=mime)])`.
   - Wrap every failure (exception, no output, validation error) in `AgentUnavailable`.
   - Try it: `fastapi dev app/main.py` with the key, then upload the 3 files from the UI or with curl.
2. **US6 — generalize the planning prompts** in `adk/prompts.py`:
   - `COMMON` says "plans software projects". It must say projects of any kind (software, field work,
     environmental, social, construction).
   - Check every stage prompt for software-only wording ("backend", "frontend", "repository", "deploy")
     and make it follow the description instead.
   - Test: create a project with the README's mangrove description and plan it with the real key. The
     board must have tasks like diagnosis, nursery, planting, monitoring, workshops, and roles like
     biologist or field coordinator.
3. **`AskCitizen(get_portal, agents).execute(slug, question)`**:
   - Call `get_portal.for_public(slug)`, then `agents.answer_citizen(portal.model_dump(mode="json"), question)`.
   - Only public data goes to the model: no drafts, no team data.
   - Unit test it with a fake agent.

## Phase 3 (1:30–2:20)

Run the demo with the real key 3 times. The restaurant invoice must be flagged every time (SC-004). If
the model is flaky, tighten the prompt, or lower the temperature in `generate_content_config`.

## Done when

The mock and the real adapter both pass the 3 demo files, the chat answers the 3 suggested questions,
and a mangrove plan has no software tasks.
