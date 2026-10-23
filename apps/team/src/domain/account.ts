// Mirrors apps/api/app/domain/accounts.py and the API contract of spec 015
// (apps/team/docs/api-contract.md, "AuthGateway" and "TeamGateway").

import { checkRange, checkText, clean, LIMITS, type FieldIssue, type Member, type Project, type Seniority } from './project'

export interface Account {
  id: number
  email: string
  name: string
  role: string | null // what they usually do; copied into each project they join
  seniority: Seniority
  hours_per_week: number
  skills: string[]
  github_username: string | null
  avatar_url: string | null // photo; null = initials. No upload yet: only the demo accounts have one
  created_at: string
  // Spec 020: who registers projects, a natural or a legal person. null until the profile is complete.
  // `name` is the full name (natural) or the legal name, razón social (legal).
  person_type: PersonType | null
  document_type: DocumentType | null
  document_number: string | null
  verification_digit: string | null // NIT only
  entity_nature: EntityNature | null // legal person only
  legal_rep_name: string | null
  legal_rep_document_type: PersonDocument | null
  legal_rep_document_number: string | null
  phone: string | null
  address: string | null
  municipality: string | null
  department: string | null
  data_consent_at: string | null // Ley 1581 de 2012: when the person authorized processing their data
}

export type PersonType = 'natural' | 'juridica'
/** Cédula de ciudadanía, cédula de extranjería, permiso por protección temporal, pasaporte. */
export type PersonDocument = 'CC' | 'CE' | 'PPT' | 'PA'
export type DocumentType = PersonDocument | 'NIT'
/** Pública, privada, or entidad sin ánimo de lucro (ESAL). */
export type EntityNature = 'publica' | 'privada' | 'esal'

export const PERSON_DOCUMENTS: readonly PersonDocument[] = ['CC', 'CE', 'PPT', 'PA']

/** A new account: no identification yet, an incomplete profile (spec 020). */
export const NO_IDENTIFICATION = {
  person_type: null, document_type: null, document_number: null, verification_digit: null, entity_nature: null,
  legal_rep_name: null, legal_rep_document_type: null, legal_rep_document_number: null,
  phone: null, address: null, municipality: null, department: null, data_consent_at: null,
} as const satisfies Partial<Account>
export const ENTITY_NATURES: readonly EntityNature[] = ['publica', 'privada', 'esal']

/** The identification fields a profile sends (spec 020). */
export const IDENTIFICATION_FIELDS = [
  'person_type', 'document_type', 'document_number', 'verification_digit', 'entity_nature',
  'legal_rep_name', 'legal_rep_document_type', 'legal_rep_document_number',
  'phone', 'address', 'municipality', 'department',
] as const
export type IdentificationField = (typeof IDENTIFICATION_FIELDS)[number]

export interface SignUp {
  name: string
  email: string
  password: string
}

export interface SignIn {
  email: string
  password: string
}

// Partial; null clears role, github_username and avatar_url. A new name renames you in every project; a new photo changes it there too.
export type ProfileUpdate = Partial<Pick<Account, 'name' | 'role' | 'seniority' | 'hours_per_week' | 'skills' | 'github_username' | 'avatar_url' | IdentificationField>> & {
  /** true stamps the data authorization (Ley 1581 de 2012); false withdraws it. */
  data_consent?: boolean
}

// Partial edit of one member by a leader. Only `permission` changes don't publish team_changed.
export type MemberUpdate = Partial<Pick<Member, 'name' | 'role' | 'seniority' | 'hours_per_week' | 'skills' | 'permission'>>

export interface Invitation {
  active: boolean
  token: string | null // the link is `${location.origin}/join/${token}`
}

export interface InvitationPreview {
  project_name: string
  leaders: string[] // names
  already_member: boolean // false when signed out
}

export interface JoinResult {
  project_id: number
  joined: boolean // false = already a member, nothing changed
}

// ---------- Rules (FR-001, FR-005), mirrored so most errors never reach the server ----------

export const ACCOUNT_LIMITS = { email: 254, password: [8, 128], github: 39, avatarUrl: 500 } as const

export const PROFILE_DEFAULTS = { seniority: 'mid' as Seniority, hours_per_week: 20 }

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const GITHUB_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9]))*$/

/** "  Ana@Team.dev " and "ana@team.dev" are the same account. */
export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export function validateSignUp(body: SignUp): FieldIssue[] {
  const issues: FieldIssue[] = []
  checkText(issues, 'name', body.name, LIMITS.name)
  const email = normalizeEmail(body.email)
  if (!email) issues.push({ field: 'email', message: 'Obligatorio.' })
  else if (!EMAIL_PATTERN.test(email)) issues.push({ field: 'email', message: 'Escribe un email válido.' })
  else if (email.length > ACCOUNT_LIMITS.email) issues.push({ field: 'email', message: `Máximo ${ACCOUNT_LIMITS.email} caracteres.` })
  const [low, high] = ACCOUNT_LIMITS.password
  if (body.password.length < low) issues.push({ field: 'password', message: `Usa al menos ${low} caracteres.` })
  else if (body.password.length > high) issues.push({ field: 'password', message: `Máximo ${high} caracteres.` })
  return issues
}

export function validateSignIn(body: SignIn): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!body.email.trim()) issues.push({ field: 'email', message: 'Obligatorio.' })
  if (!body.password) issues.push({ field: 'password', message: 'Obligatorio.' })
  return issues
}

/** A leading "@" is dropped, as the service does. */
export const cleanGithubUsername = (value: string) => value.trim().replace(/^@/, '')

/** The same limits as a member in spec 001 (FR-005), for the fields being sent. */
export function validateProfile(body: ProfileUpdate): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (body.name !== undefined) checkText(issues, 'name', body.name, LIMITS.name)
  if (body.role && clean(body.role).length > LIMITS.role) issues.push({ field: 'role', message: `Máximo ${LIMITS.role} caracteres.` })
  checkRange(issues, 'hours_per_week', body.hours_per_week, LIMITS.hours)
  body.skills?.forEach((skill, i) => {
    if (clean(skill).length > LIMITS.skill) issues.push({ field: `skills[${i}]`, message: `Máximo ${LIMITS.skill} caracteres.` })
  })
  if (body.github_username) {
    const username = cleanGithubUsername(body.github_username)
    if (username.length > ACCOUNT_LIMITS.github || !GITHUB_PATTERN.test(username)) {
      issues.push({ field: 'github_username', message: 'Solo letras, números y guiones sueltos, hasta 39.' })
    }
  }
  if (body.avatar_url?.trim() && !isAvatarUrl(body.avatar_url.trim())) {
    issues.push({ field: 'avatar_url', message: `Usa un enlace https:// o una ruta que empiece por /, hasta ${ACCOUNT_LIMITS.avatarUrl} caracteres.` })
  }
  return issues
}

/** An https link, or a path on the app's own origin (the demo photos); never `//host`. */
const isAvatarUrl = (url: string) =>
  url.length <= ACCOUNT_LIMITS.avatarUrl && (url.startsWith('https://') || (url.startsWith('/') && !url.startsWith('//')))

// ---------- Identification of a natural or legal person (spec 020), mirrored from domain/accounts.py ----------

export const IDENTIFICATION_LIMITS = { text: 120, place: 80, phone: [7, 15] } as const

// DIAN's weights for the NIT check digit, from the rightmost digit.
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

/** DIAN's check digit (dígito de verificación): "900123456" → "8", "800197268" → "4". */
export function nitCheckDigit(nit: string): string {
  const total = [...nit].reverse().reduce((sum, digit, i) => sum + Number(digit) * NIT_WEIGHTS[i], 0)
  const rest = total % 11
  return String(rest < 2 ? rest : 11 - rest)
}

export const onlyDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '')

/** "1020304050" → "1.020.304.050": how documents and NITs read in Colombia. */
export const groupDigits = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** What a complete profile is missing, with the backend's rules: nothing until a person type is chosen. */
export function validateIdentification(body: ProfileUpdate, consent: boolean): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!body.person_type) return issues
  const required = (field: string, value: string | null | undefined) => {
    if (!value?.trim()) issues.push({ field, message: 'Obligatorio.' })
    return Boolean(value?.trim())
  }
  const document = (field: string, kind: string | null | undefined, number: string | null | undefined) => {
    required(field.replace('number', 'type'), kind)
    if (!required(field, number)) return
    const clean = (number ?? '').replace(/[^0-9A-Za-z]/g, '')
    if (kind === 'CC' && !/^\d{3,10}$/.test(clean)) issues.push({ field, message: 'La cédula tiene de 3 a 10 dígitos.' })
    else if (clean.length < 3 || clean.length > 15) issues.push({ field, message: 'Entre 3 y 15 letras o números.' })
  }
  if (body.person_type === 'natural') {
    document('document_number', body.document_type, body.document_number)
  } else {
    const nit = onlyDigits(body.document_number)
    if (!nit) issues.push({ field: 'document_number', message: 'Obligatorio.' })
    else if (nit.length < 8 || nit.length > 10) issues.push({ field: 'document_number', message: 'El NIT tiene de 8 a 10 dígitos, sin el dígito de verificación.' })
    else if (!onlyDigits(body.verification_digit)) issues.push({ field: 'verification_digit', message: 'Obligatorio.' })
    else if (onlyDigits(body.verification_digit) !== nitCheckDigit(nit)) issues.push({ field: 'verification_digit', message: 'No corresponde al NIT. Revisa el RUT.' })
    required('entity_nature', body.entity_nature)
    required('legal_rep_name', body.legal_rep_name)
    document('legal_rep_document_number', body.legal_rep_document_type, body.legal_rep_document_number)
  }
  const [low, high] = IDENTIFICATION_LIMITS.phone
  const phone = onlyDigits(body.phone)
  if (!phone) issues.push({ field: 'phone', message: 'Obligatorio.' })
  else if (phone.length < low || phone.length > high) issues.push({ field: 'phone', message: `Entre ${low} y ${high} dígitos.` })
  for (const [field, limit] of [['address', IDENTIFICATION_LIMITS.text], ['municipality', IDENTIFICATION_LIMITS.place], ['department', IDENTIFICATION_LIMITS.place]] as const) {
    if (required(field, body[field]) && (body[field] ?? '').trim().length > limit) issues.push({ field, message: `Máximo ${limit} caracteres.` })
  }
  if (!consent) issues.push({ field: 'data_consent', message: 'Necesitamos tu autorización para tratar estos datos.' })
  return issues
}

/** A leader's edit of one member: the same limits, and a role is never empty. */
export function validateMemberUpdate(body: MemberUpdate): FieldIssue[] {
  const issues = validateProfile({ name: body.name, hours_per_week: body.hours_per_week, skills: body.skills })
  if (body.role !== undefined) checkText(issues, 'role', body.role, LIMITS.role)
  return issues
}

// ---------- Who can do what in a project (spec 015, US5) ----------

type Me = Pick<Account, 'id'> | null | undefined

/** My member in the project, found by account. */
export const myMember = (project: Pick<Project, 'members'>, me: Me): Member | undefined =>
  me ? project.members.find((m) => m.account_id === me.id) : undefined

/** Leaders do everything; members see everything and work on the board (FR-012). */
export const canManage = (project: Pick<Project, 'members'>, me: Me) => myMember(project, me)?.permission === 'leader'

/** Removing or demoting this member would leave the project without a leader (FR-015). */
export function isLastLeader(project: Pick<Project, 'members'>, memberId: number) {
  const leaders = project.members.filter((m) => m.permission === 'leader')
  return leaders.length === 1 && leaders[0].id === memberId
}

/** "Ana Gómez", or "Ana Gómez 2", "3"… when the project already has it; case and spaces ignored (FR-011). */
export function uniqueName(name: string, taken: string[]): string {
  const used = new Set(taken.map((t) => clean(t).toLowerCase()))
  let candidate = name
  for (let n = 2; used.has(clean(candidate).toLowerCase()); n++) candidate = `${name} ${n}`
  return candidate
}

/** The invitation link the leader shares. */
export const invitationLink = (origin: string, token: string) => `${origin}/join/${token}`
