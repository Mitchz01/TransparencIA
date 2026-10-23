# P5 — Portal + demo

You own **what the jury sees on their phone**: the public portal at `/p/:slug`, its read-only components
(P4 reuses them), the citizen chat, the tunnel that makes the QR work, the docs, and the pitch. Plan
tasks: T020, T022, T025–T027.

UI text in Spanish (spec 009). Phone first: design at 390 px wide, then check desktop. Follow
[.claude/skills/](../../../.claude/skills/README.md) and reuse `@agile/ui`. The portal is its own app
(`apps/portal`, spec 018): `npm run dev:portal` on `:5174`; it never imports from `apps/team`.

## Your files (only these)

- `apps/portal/` (the whole app; spec 018 left `PublicPortalPage`, its http gateway, `usePortal` and a test)
- `packages/ui/src/transparency/`: `TrafficLight.tsx`, `ProgressBars.tsx`,
  `BudgetLines.tsx`, `WeeklyTimeline.tsx`, `EvidenceList.tsx`, `AlertList.tsx`, `CitizenChat.tsx`
  (props fixed in the [README](README.md#frontend--read-only-components-packagesuisrctransparency-owner-p5): don't change them without telling P4).
  Exported as `@agile/ui/transparency`, so the team tab and the portal render the same ones.
- Docs: `plan/api-conventions.md`, `apps/team/docs/api-contract.md`, `plan/context.md`, `README.md`
- `specs/017-transparency-portal/demo-script.md` (new)

## Phase 1 (0:10–0:50), on the fake backend

1. **Fake public gateway** (`apps/portal/src/adapters/fake/`): returns P4's fixture (`@agile/domain/fixtures`, ready by 0:20),
   minus `drafts` and `public`, for any slug except `no-existe` (which gives 404). `ask` waits 1 s and
   answers from the fixture's lines.
2. **`usePortal(slug)`** (already there) and `useAskCitizen(slug)` on TanStack Query.
3. **Components**: read-only, all numbers come from the props, nothing computed here (SC-003).
   - `TrafficLight`: a big colored state ("En verde", "En amarillo", "En rojo") plus the reasons as a
     list. Never color alone: the word is always there.
   - `ProgressBars`: three bars on the same 0–100 scale, labeled with the value:
     - "Dinero gastado": spent of value, in pesos;
     - "Avance de actividades": "sin actividades planeadas" when `null`;
     - "Tiempo transcurrido".
     Spending over 100% overflows visibly.
   - `WeeklyTimeline`: one row per week, newest first: the week's dates, the tasks done (titles) and
     the money spent that week. On top, a small two-line SVG of `spent_pct_acc` and `physical_pct_acc`
     over the weeks, with a legend. Plain SVG, no chart library.
   - `BudgetLines`: per line, name, spent and available, and a bar. Negative available is shown in red
     with "excedido".
   - `EvidenceList`: cards with the photo thumbnail (`file_url`; PDFs get a document icon and open in a
     new tab), date, amount, line, activity (`task_title`), the citizen summary, and its alerts.
   - `AlertList`:
     - level, reason, source ("Detectada por IA" / "Regla automática"), and the answer if any;
     - wording: "en revisión", never "fraude" or "irregularidad";
     - with `onAnswer`, each alert gets "Responder" with a textarea (P4 uses it).
4. **`PublicPortalPage`**:
   - header with the project, Corpamag → foundation, the value and the dates;
   - then `TrafficLight`, `ProgressBars`, `WeeklyTimeline`, `BudgetLines`, `EvidenceList`, `AlertList`, `CitizenChat`;
   - footer: "Datos reportados por el ejecutor y verificados por reglas automáticas. Ley 1712 de 2014.";
   - 404: "Este proyecto no existe o no es público".
   No app shell, no sign-in links.

## Phase 2 (0:50–1:30)

1. **http gateway** on the real backend (`/api/public/projects/{slug}`, `.../ask`).
2. **`CitizenChat`**:
   - 3 suggested questions as chips: "¿En qué se gastaron la plata?", "¿Cuánto falta por ejecutar?",
     "¿Qué se ha sembrado?";
   - a text input of 300 chars max; answers appear as bubbles;
   - `agent_unavailable` → "El asistente no está disponible; los datos de arriba están completos".
3. **Tunnel** (T026). Start it once and keep it running all demo: its URL changes on every start.
   - `winget install --id Cloudflare.cloudflared`
   - `cloudflared tunnel --url http://localhost:5174` (the portal app; the QR points there)
   - In `apps/portal/vite.config.ts`: `server: { allowedHosts: ['.trycloudflare.com'], … }`.
   - Give the tunnel URL to P3 for `PUBLIC_APP_URL` in `apps/api/.env`, and to P4 for `VITE_PUBLIC_APP_URL`.
   - Test the seeded QR from a phone **on mobile data**, not the venue's wifi.

## Phase 3 (1:30–2:20): docs and demo

1. **Docs** (T025):
   - `plan/api-conventions.md`: the D2 and D3 exceptions and the new error codes.
   - `apps/team/docs/api-contract.md`: the new gateways and shapes.
   - `plan/context.md` and `README.md`: the product is now "gestor de proyectos + portal de
     transparencia". Copy from spec.md and plan.md, keep it short.
2. **`demo-script.md`**, 3 minutes:
   1. **Problem (20 s)**: "El SECOP te dice cuánto se firmó; nosotros te mostramos qué se hizo con esa plata."
   2. **The foundation manages the project (30 s)**: the mangrove board planned by the agents, sprints
      in progress.
   3. **Evidence (60 s)**: upload `factura-vivero.pdf`, then `factura-restaurante.jpg`. Gemini assigns
      the line and the activity, and flags the mismatch; a person confirms.
   4. **Portal (60 s)**: the jury scans the QR. They see:
      - the traffic light and why;
      - money against activities week by week;
      - the restaurant alert "en revisión";
      - the chat answering "¿en qué se gastaron la plata?".
   5. **Close (10 s)**:
      - credibility: numbers computed by rules, the AI flags but doesn't accuse, and the executing
        entity can't hide alerts;
      - who pays: CARs, alcaldías, funders;
      - who uses it: citizens and veedurías (Ley 850 de 2003, Ley 1712 de 2014).
   6. **Plan B**: if Gemini fails live, restart in mock mode (`MOCK_AGENTS=1`): same files, same result.
3. **2:20**: lead 3 rehearsals with a timer, then record the backup video (screen and phone).

## Done when

The QR opens the seeded portal on a phone on mobile data, everything readable at 390 px, the chat
answers, and the script fits in 3 minutes.
