// Spec 015: a session that ends (expired, signed out elsewhere, removed cookie) shows up as
// 401 not_authenticated on whatever call comes next. This catches it in one place for every
// gateway, so queries, mutations and direct calls all end on the sign in screen with `next`
// (frontend/docs/api-contract.md, section 2). Hooks and pages don't handle it themselves.

import { hasCode } from './errors'
import type { Gateways } from './ports'

/** Screens reachable without a session; a 401 there is expected, not a reason to leave. */
export const PUBLIC_PATHS = [/^\/login$/, /^\/signup$/, /^\/join\/[^/]+$/]

export const isPublicPath = (pathname: string) => PUBLIC_PATHS.some((pattern) => pattern.test(pathname))

/** "/login?next=%2Fprojects%2F2%2Fboard"; home needs no `next`. */
export const signInPath = (next: string) => (next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login')

/** `?next=` travels between sign in, sign up and the profile step, so the person lands where they were going. */
export const withNext = (path: string, next: string | null) => (next ? `${path}?next=${encodeURIComponent(next)}` : path)

/** Only paths inside the app, so a crafted link can't send someone elsewhere after signing in. */
export const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/')

function watch<G extends object>(gateway: G, onSignedOut: () => void): G {
  const wrapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(gateway)) {
    wrapped[key] = typeof value !== 'function'
      ? value
      : (...args: unknown[]) => {
          const result = value.apply(gateway, args)
          if (!(result instanceof Promise)) return result
          return result.catch((error: unknown) => {
            if (hasCode(error, 'not_authenticated')) onSignedOut()
            throw error
          })
        }
  }
  return wrapped as G
}

/** The gateways, with a 401 not_authenticated from any call reaching `onSignedOut`. The AuthGateway is
 *  left alone: there a 401 only means "signed out" (`me`) or "wrong password" (`signIn`). */
export function watchSession(gateways: Gateways, onSignedOut: () => void): Gateways {
  const watched = Object.fromEntries(
    Object.entries(gateways).map(([name, gateway]) => [name, name === 'auth' ? gateway : watch(gateway as object, onSignedOut)]),
  )
  return watched as unknown as Gateways
}
