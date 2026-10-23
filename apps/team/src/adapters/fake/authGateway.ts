import type { AuthGateway } from '../../application/ports'
import {
  cleanGithubUsername, IDENTIFICATION_FIELDS, NO_IDENTIFICATION, normalizeEmail, onlyDigits, uniqueName, validateIdentification, validateProfile, validateSignUp,
  type Account, type ProfileUpdate,
} from '../../domain/account'
import type { FakeAccount } from './demoData'
import { type FakeStore, fail, invalid, online, reply } from './store'
import { saveTeam } from './teamGateway'

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ')

const tidyOrNull = (value: string | null | undefined) => (value && tidy(value)) || null

/** The identification as it would be saved, like domain/accounts.py's normalize_profile (spec 020):
 *  a NIT keeps only digits and carries its check digit after a dash; a natural person drops the legal-person fields. */
function identification(account: FakeAccount, body: Omit<ProfileUpdate, 'data_consent'>, consent: boolean | undefined) {
  const merged = { ...account, ...Object.fromEntries(IDENTIFICATION_FIELDS.filter((f) => f in body).map((f) => [f, body[f]])) }
  const legal = merged.person_type === 'juridica'
  let number = merged.document_number ?? ''
  let digit = onlyDigits(merged.verification_digit) || null
  if (legal && number.includes('-') && !digit) {
    digit = onlyDigits(number.slice(number.lastIndexOf('-') + 1)) || null
    number = number.slice(0, number.lastIndexOf('-'))
  }
  const natural = merged.person_type === 'natural'
  return {
    person_type: merged.person_type,
    document_type: legal ? ('NIT' as const) : merged.document_type,
    document_number: (legal ? onlyDigits(number) : number.replace(/[^0-9A-Za-z]/g, '').toUpperCase()) || null,
    verification_digit: natural ? null : digit,
    entity_nature: natural ? null : merged.entity_nature,
    legal_rep_name: natural ? null : tidyOrNull(merged.legal_rep_name),
    legal_rep_document_type: natural ? null : merged.legal_rep_document_type,
    legal_rep_document_number: natural ? null : (merged.legal_rep_document_number ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase() || null,
    phone: onlyDigits(merged.phone) || null,
    address: tidyOrNull(merged.address),
    municipality: tidyOrNull(merged.municipality),
    department: tidyOrNull(merged.department),
    data_consent_at: consent === undefined ? account.data_consent_at : consent ? account.data_consent_at ?? new Date().toISOString() : null,
  }
}

/** What the API returns: never the password (spec 015, FR-003). */
const publicAccount = ({ password: _password, ...account }: FakeAccount): Account => account

export function fakeAuthGateway(store: FakeStore): AuthGateway {
  const byEmail = (email: string) => [...store.accounts.values()].find((a) => a.email === normalizeEmail(email))

  return {
    async signUp(body) {
      await online()
      const issues = validateSignUp(body)
      if (byEmail(body.email)) issues.push({ field: 'email', message: 'Already registered.' })
      if (issues.length) invalid(issues)
      const account: FakeAccount = {
        id: store.id(), email: normalizeEmail(body.email), name: tidy(body.name), role: null, seniority: 'mid', hours_per_week: 20,
        skills: [], github_username: null, avatar_url: null, created_at: store.now(), password: body.password, ...NO_IDENTIFICATION,
      }
      store.accounts.set(account.id, account)
      store.session = account.id
      return reply(publicAccount(account))
    },

    async signIn({ email, password }) {
      await online()
      if (!email.trim() || !password) invalid([...(email.trim() ? [] : [{ field: 'email', message: 'Required.' }]), ...(password ? [] : [{ field: 'password', message: 'Required.' }])])
      const account = byEmail(email)
      // The same answer for a wrong password and an unknown email (FR-002).
      if (!account || account.password !== password) fail(401, { code: 'invalid_credentials', detail: 'Wrong email or password.' })
      store.session = account!.id
      return reply(publicAccount(account!))
    },

    async signOut() {
      store.session = null
      return reply(undefined)
    },

    async me() {
      return reply(publicAccount(store.signedIn()))
    },

    async updateProfile(body) {
      await online()
      const account = store.signedIn()
      if (Object.keys(body).length === 0) invalid([{ field: '', message: 'No fields to update.' }])
      const { data_consent: consent, ...fields } = body
      const identity = identification(account, fields, consent)
      const issues = [...validateProfile(fields), ...validateIdentification(identity, identity.data_consent_at !== null)]
      if (issues.length) invalid(issues, 'El perfil tiene campos con errores.')
      const updated: FakeAccount = {
        ...account,
        ...fields,
        ...identity,
        name: body.name === undefined ? account.name : tidy(body.name),
        role: body.role === undefined ? account.role : body.role && tidy(body.role) ? tidy(body.role) : null,
        skills: body.skills ? [...new Set(body.skills.map(tidy).filter(Boolean))] : account.skills,
        github_username: body.github_username === undefined ? account.github_username : body.github_username ? cleanGithubUsername(body.github_username) : null,
        avatar_url: body.avatar_url === undefined ? account.avatar_url : body.avatar_url?.trim() || null,
      }
      store.accounts.set(account.id, updated)
      // A new name and a new photo follow you into every project; the rest of the project's data is the leader's call.
      // saveTeam publishes team_changed for the name only: the photo isn't a team change.
      if (updated.name !== account.name || updated.avatar_url !== account.avatar_url) {
        for (const project of store.projects.values()) {
          const mine = project.members.find((m) => m.account_id === account.id)
          if (!mine) continue
          const name = updated.name === account.name ? mine.name : uniqueName(updated.name, project.members.filter((m) => m.id !== mine.id).map((m) => m.name))
          saveTeam(store, project.id, project.members.map((m) => (m.id === mine.id ? { ...m, name, avatar_url: updated.avatar_url } : m)))
        }
      }
      return reply(publicAccount(updated))
    },
  }
}
