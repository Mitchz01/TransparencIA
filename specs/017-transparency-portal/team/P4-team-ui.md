# P4 — Team UI

You own **what the foundation uses**: the "Transparencia" tab of each project, with:
- the budget editor;
- uploading evidence and reviewing the AI's draft before confirming;
- alerts;
- publishing with the QR.
You also own the frontend's shared types and gateway, and the cuts in the navigation. Plan tasks: T001
(frontend), T016, T017, T024, and the "Responder" part of US5.

UI text in Spanish (spec 009). Follow [.claude/skills/](../../../.claude/skills/README.md) and reuse
`ui/components/ds`.

## Your files (only these)

- `frontend/src/domain/transparency.ts` and `frontend/src/application/ports.ts` (skeleton; you own
  later changes; announce them, since P5 depends on them)
- `frontend/src/adapters/http/transparencyGateway.ts`, `adapters/http/client.ts` (multipart upload)
- `frontend/src/adapters/fake/transparencyGateway.ts`, `adapters/fake/demoTransparency.ts` (the fixture;
  P5 imports it read-only)
- `frontend/src/application/use-cases/useTransparency.ts`
- `frontend/src/ui/pages/TransparencyPage.tsx`
- `frontend/src/ui/components/transparency/`: `BudgetEditor.tsx`, `EvidenceUpload.tsx`,
  `ExpenseReviewForm.tsx`, `QrCard.tsx` (the read-only ones are P5's: import them, don't edit them)
- `frontend/src/ui/components/shell/sections.ts`, `frontend/src/app/routes.tsx` (skeleton; you own later changes)

## Phase 1 (0:10–0:50), on the fake backend (`VITE_USE_FAKE=true`)

1. **Fixture** `demoTransparency.ts`: the README's demo project as a `TeamPortal`, with:
   - the numbers of the [README](README.md#the-demo-project-same-numbers-everywhere);
   - a `summary` that's yellow, with reasons;
   - about 11 weeks of `timeline`;
   - 3 expenses, plus 1 draft.
   P5 builds the portal on it too, so do it first and push it by 0:20.
2. **Fake gateway**: in-memory over the fixture. `uploadEvidence` waits 1.5 s and returns a draft chosen
   by filename, like P2's mock (`restaurante` → alert). `confirmExpense` moves the draft to `expenses`.
3. **Hooks** `useTransparency.ts`, on TanStack Query like `useDocuments.ts`:
   - `useBudget`, `useSetBudget`
   - `useTeamPortal`
   - `useUploadEvidence`, `useConfirmExpense`, `useDiscardExpense`
   - `useSetPublication`, `useAnswerAlert`
   Each mutation invalidates the team portal. Errors go through `useApiErrorToast`.
4. **`TransparencyPage`**, top to bottom:
   - **No budget yet**: an empty state with the `BudgetEditor`.
   - **Header**: P5's `TrafficLight` and `ProgressBars`, plus the `QrCard`.
   - **`BudgetEditor`** (leaders; read-only for members):
     - contracting entity, contractor, value, start date (end date shown, not edited);
     - lines with add and remove;
     - the sum against the value, and "sin asignar" when they don't match.
   - **"Registrar gasto"**: the `EvidenceUpload` drop zone (PDF/JPG/PNG/WebP, 10 MB), with a spinner
     "Leyendo el documento con IA…" while the agent reads it.
   - **Drafts**: each opens an `ExpenseReviewForm`:
     - a preview of the file;
     - every field editable: kind, amount, date, supplier, concept;
     - a budget line select and a task select (tasks from `useBoard`);
     - the citizen summary;
     - the AI's alerts, labeled "IA".
     - Buttons: "Confirmar y publicar" and "Descartar".
   - Then P5's `BudgetLines`, `EvidenceList`, and `AlertList` with `onAnswer` (leaders) for US5.

## Phase 2 (0:50–1:30), on the real backend

1. **`transparencyGateway.ts`** (http). `uploadEvidence` sends `FormData` (field `file`) without a JSON
   `Content-Type`; adjust `client.ts` so it doesn't force one for `FormData`. Errors:
   - `unsupported_file`: inline message under the drop zone.
   - `agent_unavailable`: "No pudimos leer el documento", with "Reintentar" and "Llenar a mano".
   - `budget_missing`: points to the budget editor.
2. **`QrCard`** (T024):
   - A "Publicar portal" / "Despublicar" switch (leaders).
   - When public: the link and a copy button, the QR (`qrcode` → `toDataURL`, 256 px), "Abrir portal",
     and "Descargar QR" (PNG).
   - The URL is `public_url`; when it starts with `/`, prefix `VITE_PUBLIC_APP_URL` or `window.location.origin`.
3. **Cuts in navigation** (`sections.ts`): remove Documentos and Integraciones; Transparencia comes
   right after Tablero. Routes stay (D13). Check that no screen in the demo's path links to them (the
   planning screen's "documents" step, the home launchpad cards) and hide those links too. Tell the
   group if one is in someone else's file.

## Phase 3 (1:30–2:20)

Run the foundation's part of the demo on the real backend with the real key: upload the 3 files,
confirm, publish, scan the QR. Check it on a phone width too.

## Done when

`npm run typecheck`, `npm run lint` and `npm test` are green. The team can go from upload to confirmed
expense to portal in under 1 minute (SC-001).
