// UC-15 (spec 015): who is signed in on this device, signing up, in and out, and the profile.
// Signing in or out starts from an empty cache, so nothing of the previous account stays on screen.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { canManage, validateProfile, validateSignIn, validateSignUp, type Account, type ProfileUpdate, type SignIn, type SignUp } from '../../domain/account'
import { toFieldErrors, type FieldErrors } from '../../domain/rules'
import { hasCode } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useApiErrorToast, say } from './useApiErrorToast'
import { useProject } from './useProjects'

/** What the sign up form shows under the email when it's taken; the page adds a link to sign in. */
export const EMAIL_TAKEN = 'Ese email ya tiene cuenta.'

/** The signed-in account, `null` when signed out. Loaded once; signing in or out replaces it. */
export function useMe() {
  const { auth } = useGateways()
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: async (): Promise<Account | null> => {
      try {
        return await auth.me()
      } catch (error) {
        if (hasCode(error, 'not_authenticated')) return null
        throw error
      }
    },
    staleTime: Infinity,
  })
}

export function useSession() {
  const { auth } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const me = useMe()

  /** A new account on this device: forget everything cached for the previous one. */
  const start = useCallback(
    (account: Account | null) => {
      // `me` stays (with its new value) so whoever watches it hears the change.
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me()[0] })
      client.setQueryData(queryKeys.me(), account)
    },
    [client],
  )

  const signIn = useCallback(
    async (body: SignIn): Promise<FieldErrors> => {
      const local = toFieldErrors(validateSignIn(body))
      if (Object.keys(local).length) return local
      try {
        start(await auth.signIn(body))
        return {}
      } catch (error) {
        // Same words for a wrong password and an unknown email, at the top of the form (FR-002).
        if (hasCode(error, 'invalid_credentials')) return { '': say('invalid_credentials', '') }
        return reportError(error, { failure: 'No se inició la sesión', form: true })
      }
    },
    [auth, start, reportError],
  )

  const signUp = useCallback(
    async (body: SignUp): Promise<FieldErrors> => {
      const local = toFieldErrors(validateSignUp(body))
      if (Object.keys(local).length) return local
      try {
        start(await auth.signUp(body))
        return {}
      } catch (error) {
        const errors = reportError(error, { failure: 'No se creó la cuenta', form: true })
        return errors.email === 'Already registered.' ? { ...errors, email: EMAIL_TAKEN } : errors
      }
    },
    [auth, start, reportError],
  )

  const signOut = useCallback(async () => {
    try {
      await auth.signOut()
    } catch {
      // Signing out always ends here: the screen goes to sign in either way.
    }
    start(null)
  }, [auth, start])

  const updateProfile = useCallback(
    async (body: ProfileUpdate): Promise<FieldErrors> => {
      const local = toFieldErrors(validateProfile(body))
      if (Object.keys(local).length) return local
      try {
        client.setQueryData(queryKeys.me(), await auth.updateProfile(body))
        // A new name renames you in every project.
        if (body.name !== undefined) {
          void client.invalidateQueries({ queryKey: ['project'] })
          void client.invalidateQueries({ queryKey: queryKeys.projects() })
        }
        return {}
      } catch (error) {
        return reportError(error, { failure: 'No se guardó el perfil', form: true })
      }
    },
    [auth, client, reportError],
  )

  return { me: me.data, isPending: me.isPending, signIn, signUp, signOut, updateProfile }
}

/** Whether the signed-in person leads this project (spec 015, US5). Leader actions are hidden otherwise. */
export function useCanManage(projectId: number): boolean {
  const { data: project } = useProject(projectId)
  const { data: me } = useMe()
  return project ? canManage(project, me) : false
}
