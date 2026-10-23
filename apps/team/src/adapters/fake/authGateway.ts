import type { AuthGateway } from '../../application/ports'
import { cleanGithubUsername, normalizeEmail, uniqueName, validateProfile, validateSignUp, type Account } from '../../domain/account'
import type { FakeAccount } from './demoData'
import { type FakeStore, fail, invalid, online, reply } from './store'
import { saveTeam } from './teamGateway'

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ')

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
        skills: [], github_username: null, avatar_url: null, created_at: store.now(), password: body.password,
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
      const issues = validateProfile(body)
      if (issues.length) invalid(issues, 'El perfil tiene campos con errores.')
      const updated: FakeAccount = {
        ...account,
        ...body,
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
