# Project constitution

Principles that every spec, plan and implementation must follow.

1. **Demo first**: the full flow project → team → plan → kanban has to work end to end before any extra.
2. **Structured outputs**: everything an agent generates has a schema and is persisted; no free text that can't be displayed.
3. **Agent transparency**: the user sees which agent is working and why it decided what it decided (visible rationale).
4. **The user is in charge**: if they pick a methodology, the agents respect it; everything generated is editable.
5. **Simple before scalable**: monolith, SQLite, no user auth until it's needed (GitHub uses one token per project).
6. **Works without a key**: mock mode is always available to develop the frontend.
7. **Google stack**: Gemini + ADK for AI; Cloud Run as the deployment target.
8. **Nothing is applied without approval**: every agent decision is a proposal that the user approves, adjusts or rejects (or that is approved automatically if the project has auto-approve on).
9. **Hexagonal**: the domain doesn't depend on frameworks or external services; everything from outside comes in through a port.
