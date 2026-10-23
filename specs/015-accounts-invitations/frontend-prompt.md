# Prompt: spec 015 frontend (accounts, invitations and project roles)

Paste everything below the line into the assistant that will build the frontend. It's written for an AI coding agent working in this repo (Claude Code, Gemini CLI, Copilot, Cursor), but a person can follow it too.

---

You are implementing the **frontend** of spec 015 (accounts, invitations and project roles) in this repo. The backend is already done and tested; your job is the React app in `frontend/`.

## Read first, in this order

1. `AGENTS.md`: the SDD workflow, the stack, the hexagonal layers and the conventions. Everything in English except the UI text, which is in **Spanish**.
2. `specs/015-accounts-invitations/spec.md`: the what and why. Stories 1 to 6, FR-016 (fake Google, GitHub and SSO buttons) and FR-017 (spec 009's UI rules apply).
3. `specs/015-accounts-invitations/plan.md`: the API Contract, the "Guards on the existing endpoints" table (which actions are leader-only) and **Phase 10**, the tasks you'll tick (`- [x]`) one by one.
4. `frontend/docs/api-contract.md`: section 1 (auth row), section 2 (401, 403 and the new codes), section 3 (`Account`, `Permission`, `Invitation`, `InvitationPreview`, `JoinResult`, and the new `Member` and `ProjectSummary` fields), section 4 (`ProjectGateway` changed, new `AuthGateway` and `TeamGateway`).
5. `specs/009-frontend/spec.md` FR-001 to FR-012 and `frontend/design-system/README.md`: every screen uses only the design system, its tokens and its rules. If a piece is missing, add it to the design system first.
6. `.claude/skills/README.md` and the skills it lists (visual design, React composition and performance, UI audit). Use them.

Look at how an existing feature is built end to end before writing anything new, e.g. `ProjectGateway` in `src/application/ports.ts`, `src/adapters/http/projectGateway.ts`, `src/adapters/fake/projectGateway.ts`, `src/application/use-cases/useProjects.ts` and `src/ui/pages/ProjectsPage.tsx`. Match their style, naming and comment density.

## What changed in the backend (short)

- **Session cookie.** `POST /api/auth/signup` and `/signin` set an `HttpOnly` cookie, `agile_session`. `fetch` and `EventSource` send it on their own because the Vite proxy makes `/api` same-origin. Never read, store or send a token yourself.
- **Every `/api` endpoint needs the session** except sign up, sign in, `GET /api/invitations/{token}` and health. Without it: `401 not_authenticated`.
- **Projects** are only visible to their members. Outsiders get the resource's `404`. A member doing a leader action gets `403 forbidden`.
- **Creating a project takes no `members`.** It takes an optional `role` (your role in this project). The creator is the only member, as `leader`, copied from their profile. Everyone else joins with the invitation link.
- **`PATCH /api/projects/{id}` no longer edits the team.** Members are edited with `PATCH /api/projects/{id}/members/{member_id}` and removed (or leave) with `DELETE …/members/{member_id}`.
- `Member` has `account_id` and `permission` (`leader` | `member`). `ProjectSummary` has the caller's `permission`.
- The invitation link is `${location.origin}/join/${token}`. The token comes from `GET /api/projects/{id}/invitation` (leaders only).

## Tasks (plan.md, Phase 10)

Work in this order. Tick each task in `plan.md` when it's done and tested.

### T024 · Domain (`src/domain/`)

- In `project.ts`, add `Permission`. Add `account_id: number | null` and `permission` to `Member`, and `permission` to `ProjectSummary`. Remove `members` from `ProjectCreate` and add `role?: string`. `ProjectUpdate` loses `members`.
- Add `account.ts` with `Account`, `ProfileUpdate`, `Invitation`, `InvitationPreview`, `JoinResult`, `MemberUpdate`, and the pure rules:
  - `validateSignUp` and `validateProfile`: the same limits as the backend, listed in the contract's AuthGateway table.
  - `myMember(project, me)` (`account_id === me.id`).
  - `canManage(project, me)` (my member is `leader`).
  - `isLastLeader(project, memberId)`.
- `validateMembers` and the `members` part of `validateProjectCreate` go away. Keep `validateProject` for the remaining fields, plus `role`.
- Unit tests for every new rule.

### T025 · Ports and HTTP adapters

- `src/application/ports.ts`: add `AuthGateway` and `TeamGateway` exactly as in the contract (`signUp`, `signIn`, `signOut`, `me`, `updateProfile`; `updateMember`, `removeMember`, `getInvitation`, `renewInvitation`, `disableInvitation`, `previewInvitation`, `join`). Add both to `Gateways`.
- `src/adapters/http/`: write `authGateway.ts` and `teamGateway.ts`, and update `projectGateway.ts`.
- Leave `client.ts` alone apart from making sure `401` reaches the caller as an `ApiError` (it already does). The redirect belongs in the application layer (T027), so adapters stay dumb.

### T026 · Fake backend (`src/adapters/fake/`)

The app must keep working with `VITE_USE_FAKE=true` (spec 009, FR-007; spec 015, FR-018).

- **Store:** accounts (with a password, in memory only), the current session, an invite token per project, and `account_id` and `permission` on the seeded members.
- **Starting state:** signed in as a demo leader ("Ana") who leads every seeded project, with one demo member ("Leo", `member`) on each. Also seed a second demo account, so a person can sign out and sign in as Leo to see the member view. Use the same password for both and note it in a comment.
- **Same answers as the real API:** `401` when signed out, `404` for outsiders, `403` for members on leader actions, `409 last_leader`, `422` with the same field errors, and `invitation_not_found`.
- **Events:** joining, leaving and member edits publish `team_changed` on the fake event stream, like the real one. Permission-only changes don't publish it.
- **Console helper:** extend `window.fakeBackend` with `signInAs(name)` so the demo can switch users from the console.

### T027 · Session and route guard

- Add `src/application/use-cases/useSession.ts` built on TanStack Query:
  - `me` (`null` when the call answers `401`).
  - `signIn`, `signUp` and `signOut`, each of which resets the query cache.
  - `updateProfile`.
- In `src/app/routes.tsx`, wrap every screen except `/login`, `/signup` and `/join/:token` in a guard. While `me` loads, show the page background (no flash, like `hydrateFallbackElement`). With no session, go to `/login?next=<path>`.
- Any `401 not_authenticated` from any query or mutation drops the cache and goes to `/login?next=<current path>`. Do it in one place, e.g. the `QueryClient`'s `queryCache` and `mutationCache` `onError`, not in every hook.
- `403 forbidden` shows a toast with `detail` and refetches the project.

### T028 · Screens: sign in, sign up, profile, join

Use the voice in `design-system/README.md`: short, direct Spanish, no emojis, no em dashes. The copy below is a starting point.

- **`/login` ("Iniciar sesión")**
  - Fields: email and password.
  - `invalid_credentials` shows its `detail` above the form ("Email o contraseña incorrectos.") without marking a field.
  - Link to `/signup` that keeps `next`.
  - Below the form, separated by a short "o" label (no separator line), three secondary buttons with their icons: "Continuar con Google", "Continuar con GitHub" and "Continuar con SSO". They only show the toast "Próximamente" and do nothing else (FR-016). Check the icon set in `ds/icons.ts`; add the logos to the design system if they're missing.
- **`/signup` ("Crear cuenta")**
  - Fields: name, email and password, with an 8-character hint under the password.
  - Errors show under each field; "Already registered." means "Ese email ya tiene cuenta" plus a link to sign in.
  - On success, go to the profile step.
- **Profile step (`/welcome`), then also `/profile`**
  - One short screen titled "Cuéntanos qué haces" (or similar). Every field has a default, and the screen can be skipped ("Omitir").
  - Role: `Chip`s for common roles (Frontend, Backend, Fullstack, Diseño, QA, DevOps, Producto) plus "Otro" with a text input.
  - Seniority: three chips or a `Segmented`.
  - Hours per week: a number field defaulting to 20.
  - Skills: reuse `SkillsField`.
  - GitHub username: optional.
  - After saving or skipping, go to `next` or `/`.
  - `/profile` is the same form for editing later, reached from the account menu.
- **`/join/:token`**
  - Calls `previewInvitation`. Shows "Te invitaron a **{project_name}**" and "Líder: {leaders}".
  - A required role field, prefilled from the profile, so the person confirms it. Then one primary button, "Unirme".
  - Signed out: the same preview with "Iniciar sesión" / "Crear cuenta" buttons that carry `next=/join/{token}`. After sign up and the profile step, the person lands back here.
  - `already_member: true`: go straight to the project.
  - `invitation_not_found`: "Esta invitación ya no es válida. Pide al líder un link nuevo." with a link home.
  - After joining, go to `/projects/{project_id}/board`.
  - Target from the spec: under 1 minute from link to board for a new person (SC-001), so keep every step short.

### T029 · New project and project list

- `NewProjectPage` / `ProjectForm`:
  - Remove the team section (`MemberRows` is no longer used to create).
  - Add "Tu rol en este proyecto", prefilled from the profile's role and required when the profile has none.
  - Explain in one line that the team joins with a link after creating the project.
- After creating, go to the project's Team screen so the leader sees the link right away.
- `ProjectsPage`:
  - Only lists your projects (the API already filters them).
  - Show the permission in each card as "Líder" or "Miembro", as icon plus word (spec 009, FR-009).
  - Keep at most three numbers per card.

### T030 · Team screen (`/projects/:projectId/team`)

- **Navigation:** add "Equipo" to `src/ui/components/shell/sections.ts` (icon `UserGroupIcon`). `TeamAvatars` on the board links here instead of to settings.
- **Invitation card** (leaders only):
  - The link in a read-only field, with "Copiar link" (clipboard, then the toast "Link copiado").
  - "Crear link nuevo", with a confirmation: "El link anterior deja de funcionar".
  - A switch for "Invitaciones activas" (off = `disableInvitation`, on = `renewInvitation`).
- **Member list:** use a row list (`Rows`) with avatar, name, role, seniority, hours, skills and a "Líder" `Pill` for leaders. Mark your own row with "Tú".
- **Leader actions per row** (in a `Menu`):
  - "Editar": a form in an `Overlay` for name, role, seniority, hours and skills.
  - "Hacer líder" / "Quitar como líder".
  - "Quitar del equipo", with a confirmation that says their pending tasks will be unassigned.
- **Your own row** has "Salir del proyecto" for everyone, with a confirmation; afterwards go to `/`.
- **`409 last_leader`:** show its `detail` next to the action.
- **Members** see the list read-only (no menu) and "Salir del proyecto".
- **Settings:** `SettingsPage` loses the team section and points to the Team screen. Update its description accordingly.
- **Live updates:** refresh the project on `team_changed` from SSE. Hook it into `liveUpdates.ts` if it isn't already.

### T031 · Hide leader actions from members

Using `canManage(project, me)`, **hide** (don't disable) every leader action for members (FR-017). These are the actions in plan.md's "Guards on the existing endpoints" table under `manage`:

- Start planning, and retry a stage.
- Approve, adjust and reject proposals, approve them in bulk, and retry applying one.
- Replan, and close a sprint.
- The sprint capacity control.
- Connect and disconnect the repo, publish issues, and set GitHub usernames.
- Regenerate a document.
- Every field in Settings (a member sees them read-only, or Settings is hidden from the rail).
- The invitation card and the member menu.

A member still keeps all of these:

- Moving cards and editing tasks.
- Checklists.
- Quick add.
- Editing documents.
- Reading everything.

Where a page would be empty for a member (e.g. a proposal waiting for approval), show what the leader will do instead ("Esperando la aprobación del líder").

### T032 · Account menu

In the top bar, both `HomeTopBar` and `ProjectTopBar`, add an `Avatar` button that opens a `Menu`. It shows the name and email, then "Mi perfil" (`/profile`) and "Cerrar sesión". Signing out goes to `/login`.

### T033 · Tests and checks

- Vitest + Testing Library against the **fake gateways**, like the existing page tests. At least these:
  - Sign in error: same message for a wrong password and an unknown email.
  - The fake Google button only shows "Próximamente".
  - Sign up leads to the profile step.
  - Join when signed out: preview, sign up, back to the link, join.
  - Join with an invalid link.
  - A member doesn't see approve, replan or settings actions but can move a card.
  - The leader renews the link, and the old one fails.
  - Last leader error.
  - Leaving a project.
  - A `401` from any call goes to `/login?next=…`.
- Run `npm run typecheck`, `npm run lint` (oxlint + `scripts/check-design-rules.mjs`) and `npm test`. All must pass.
- Run the app against the real backend (`cd backend && fastapi dev app/main.py` plus `npm run dev`) and go through the demo:
  1. Sign up as the leader.
  2. Create a project.
  3. Copy the link.
  4. In a private window, sign up as a second person and join.
  5. As the leader, plan with auto-approve.
  6. As the member, move a card, and check that no leader actions show.
- **Before that run, delete `backend/agile.db`.** The backend refuses to start on a database from before spec 015 and says so.

## Rules that are easy to miss

- **Layers:** `ui → application → domain`. Only `src/app/container.tsx` imports `adapters/`. Pages never call `fetch`.
- **Domain mirror:** the types in `src/domain` mirror `backend/app/domain/` (`accounts.py`, `project.py`). Keep the field names in `snake_case`, like the API.
- **Forms:** validate before sending (FR-008), show each error under its field, and keep what was typed. Map `errors[].field` from a 422 onto the inputs. `""` goes at the top.
- **States** are icon plus word, never color alone.
- **Keyboard and accessibility:** everything works from the keyboard. Icon-only buttons need an accessible name. Text needs 4.5:1 contrast in both themes.
- **No new dependencies** unless the design system can't do something. If you think it can't, say so before adding one.
- **Contradictions:** if you find one between the spec and what you need, update the spec or the plan first (AGENTS.md), and say so in your summary.
- **Done means:** Phase 10 is ticked in `plan.md`, every check passes, and your summary lists anything you couldn't finish.
