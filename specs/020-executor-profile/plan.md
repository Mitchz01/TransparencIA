# Implementation Plan: The profile of whoever registers a public project

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

The account gains the identification fields of a natural or legal person, validated in the domain (NIT
check digit included) and mirrored in the team app. The profile form, the step after sign-up and the
member edit drop the software fields. The demo accounts move to `@manglaresvivos.org`.

## Technical Context

**Language/Version**: Python 3.13; TypeScript 6 + React 19  
**Storage**: new nullable columns on `account` (`create_all` doesn't migrate: `rm agile.db && python -m app.seed`)  
**Testing**: pytest (domain rules, the PATCH /api/me rows); vitest (rules, the profile flow)

### Decisions

- **D1 — New fields on `Account`, all nullable**: `person_type` (`natural | juridica`), `document_type`
  (`CC | CE | PPT | PA | NIT`), `document_number` (digits, or letters and digits for PA/PPT/CE),
  `verification_digit`, `entity_nature` (`publica | privada | esal`), `legal_rep_name`,
  `legal_rep_document_type`, `legal_rep_document_number`, `phone`, `address`, `municipality`,
  `department`, `data_consent_at`. Old accounts read as an incomplete profile.
- **D2 — Validation on the merged account** (`validate_profile`): when `person_type` is set, every field
  its type requires must be there; a legal person's `document_type` is always `NIT` and its check digit
  must match (DIAN weights 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71; r = sum mod 11;
  dv = r if r < 2 else 11 − r). Switching to natural clears the legal-person fields.
- **D3 — Consent**: `PATCH /api/me` takes `data_consent: boolean`; `true` stamps `data_consent_at` (kept
  if already set), `false` clears it. A complete profile requires it.
- **D4 — Software fields stay in the model** (`role`, `seniority`, `hours_per_week`, `skills`,
  `github_username`): projects still copy them when someone joins, and the agents use hours. They leave
  the profile; the member edit keeps cargo and hours.
- **D5 — The email is the notification address** (Ley 1437 art. 56); it's shown, not edited.

## API Contract

Changes to `Account` (responses of `/api/auth/signup`, `/api/auth/signin`, `GET /api/me`, `PATCH /api/me`):

```json
{ "person_type": "juridica", "document_type": "NIT", "document_number": "900123456",
  "verification_digit": "8", "entity_nature": "esal",
  "legal_rep_name": "Ana Gómez", "legal_rep_document_type": "CC", "legal_rep_document_number": "52123456",
  "phone": "3001234567", "address": "Calle 22 # 3-45", "municipality": "Santa Marta",
  "department": "Magdalena", "data_consent_at": "2026-10-23T20:00:00Z" }
```

`PATCH /api/me` accepts the same fields (null clears them) plus `data_consent: boolean`. New
`validation_failed` paths: `person_type`, `document_type`, `document_number`, `verification_digit`,
`entity_nature`, `legal_rep_name`, `legal_rep_document_type`, `legal_rep_document_number`, `phone`,
`address`, `municipality`, `department`, `data_consent`. To be agreed with the contracts owner.

## Phase 1: Backend

- [ ] T001 `domain/accounts.py`: fields, `nit_check_digit`, rules in `validate_profile` (D1, D2)
- [ ] T002 `dto.ProfileUpdate` + `data_consent`; `UpdateProfile` (nullable fields, consent) (D3)
- [ ] T003 `AccountTable` columns
- [ ] T004 Seed: demo accounts at `@manglaresvivos.org` with complete profiles (FR-007)
- [ ] T005 Tests: check digit, natural and legal rules, switching type, consent, the API rows

## Phase 2: Team app

- [ ] T006 `domain/account.ts`: types, `nitCheckDigit`, `validateProfile` mirror
- [ ] T007 `ProfileForm`, `ProfileCard`, the step after sign-up: person type and its fields, consent
- [ ] T008 Member edit: name, cargo and hours only
- [ ] T009 Fake backend: demo accounts and `updateProfile` with the new fields
- [ ] T010 Tests; `apps/team/docs/api-contract.md`; AGENTS.md demo accounts

## Phase 3: Polish

- [ ] T011 `pytest`, `npm run typecheck`, `npm run lint`, `npm test`
