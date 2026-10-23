# Feature Specification: The profile of whoever registers a public project

**Created**: 2026-10-23  
**Status**: Draft

The person who signs up registers and executes public projects: a foundation, a company, an alcaldía's
office, or an individual contractor. Today their profile asks what a software team asks (role "Backend",
seniority, skills, GitHub user) and the demo accounts end in `@team.dev`. This feature turns the profile
into the identification Colombian rules ask of whoever contracts with the State: a **natural person**
(persona natural) or a **legal person** (persona jurídica), with their document, contact and location,
and the authorization to process personal data.

References: RUT (DIAN, Estatuto Tributario art. 555-2), the NIT and its check digit (dígito de
verificación); Ley 80 de 1993 and Decreto 1082 de 2015 (contracting with the State: identification and
legal representative); Ley 1581 de 2012 and Decreto 1377 de 2013 (personal data: prior, express,
informed authorization); Ley 1437 de 2011 art. 56 (electronic notification address).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A natural person completes their profile (Priority: P1)

An individual contractor signs up and gives their document type and number, full name, mobile phone,
address, municipality and department, and authorizes the processing of their data. Their email is the
notification address.

**Why this priority**: it's who executes many small public contracts, and the profile must stop asking
for software data.

**Independent Test**: sign up, choose "Persona natural", fill the fields and save; reopen the profile and
see them.

**Acceptance Scenarios**:

1. **Scenario**: Complete profile
   - **Given** a new account
   - **When** they choose "Persona natural", "Cédula de ciudadanía", 1020304050, their name, a mobile, an
     address in Santa Marta (Magdalena) and accept the data authorization
   - **Then** the profile is saved and shows their document, phone and location
2. **Scenario**: Missing data
   - **When** they save without the document number or without accepting the authorization
   - **Then** each missing field says what's needed and nothing is saved

---

### User Story 2 - A legal person completes its profile (Priority: P1)

A foundation signs up with its NIT and check digit, its legal name (razón social), its nature (public,
private, non-profit), its legal representative (name, document type and number), phone, address,
municipality and department, and authorizes the processing of data.

**Why this priority**: the demo's executing entity is a foundation; contracts with the State are signed
by legal persons through their legal representative.

**Independent Test**: choose "Persona jurídica", type NIT 900123456 with check digit 8, fill the rest
and save; type check digit 3 and see the error.

**Acceptance Scenarios**:

1. **Scenario**: Valid NIT
   - **When** they enter NIT 900123456-8, "Fundación Manglares Vivos", "Sin ánimo de lucro", the legal
     representative and the contact data
   - **Then** the profile is saved and shows "NIT 900.123.456-8"
2. **Scenario**: Wrong check digit
   - **When** the check digit doesn't match the NIT
   - **Then** the field says the check digit doesn't match, and nothing is saved
3. **Scenario**: Switching type
   - **When** an account saved as a legal person switches to natural person
   - **Then** the NIT, nature and legal representative are cleared

---

### User Story 3 - Nothing of software development in the profile (Priority: P1)

The profile, the sign-up step after creating the account and the team screen show no role chips
("Frontend", "Backend"), seniority, skills or GitHub user. The demo accounts use the foundation's domain.

**Why this priority**: the users don't work in software; those fields confuse them and the jury.

**Independent Test**: open the profile, the step after sign-up and a member's edit dialog, and find none
of those fields; sign in as `ana@manglaresvivos.org`.

**Acceptance Scenarios**:

1. **Scenario**: Team member edit
   - **When** a leader edits a member
   - **Then** they see the member's name, position (cargo) and dedication in hours per week, nothing else

---

### Edge Cases

- An account created before this feature has no person type: the profile asks to complete it; the app
  keeps working.
- A NIT typed with dots or a dash ("900.123.456-8") is read as NIT 900123456 and check digit 8.
- Withdrawing the data authorization is allowed (Ley 1581): the profile is then incomplete again.
- The email can't be edited here (it's the account); it's shown as the notification address.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The profile MUST ask for the person type: natural or legal.
- **FR-002**: A natural person MUST give document type (cédula de ciudadanía, cédula de extranjería,
  permiso por protección temporal, pasaporte), document number, full name, phone, address, municipality
  and department.
- **FR-003**: A legal person MUST give NIT and check digit, legal name, nature (public, private,
  non-profit), legal representative's name, document type and number, phone, address, municipality and
  department.
- **FR-004**: The check digit MUST be validated with the DIAN algorithm.
- **FR-005**: Saving a complete profile MUST require the authorization to process personal data, with
  the text of the purpose; the date of the authorization MUST be kept.
- **FR-006**: The profile, the step after sign-up and the member edit MUST NOT show role chips,
  seniority, skills or GitHub user. A project member keeps a position (cargo) and dedication (hours per
  week).
- **FR-007**: The demo accounts MUST be `ana@manglaresvivos.org` (the foundation, legal person) and
  `leo@manglaresvivos.org` (a field technician, natural person), same password.

### Key Entities

- **Account**: gains person type, document type and number, check digit, nature, legal representative
  (name, document type and number), phone, address, municipality, department and the data authorization
  date. Role, seniority, hours, skills and GitHub user stay inside (projects still copy them) but leave
  the screens.

## Success Criteria *(mandatory)*

- **SC-001**: None of "Frontend", "Backend", "Seniority", "Habilidades" or "GitHub" appears in the
  profile, the step after sign-up or the member edit.
- **SC-002**: A wrong NIT check digit is rejected every time, in the browser and in the API.
- **SC-003**: A natural person and a legal person each complete their profile in under 2 minutes.

## Out of scope

- Verifying documents against the RUES, the DIAN or the Registraduría.
- Uploading the RUT, the chamber of commerce certificate or the legal representative's ID.
- The DANE list of municipalities (typed as text for now).
