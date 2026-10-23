// UC-16 and UC-17 (spec 015): the invitation link, joining with it, and the leader managing the team.
// Team changes also arrive over SSE as team_changed (liveUpdates.ts), so other screens follow.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { validateMemberUpdate, type Invitation, type MemberUpdate } from '../../domain/account'
import type { ProjectSummary } from '../../domain/project'
import { toFieldErrors, type FieldErrors } from '../../domain/rules'
import { hasCode, isApiError } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { say, useApiErrorToast } from './useApiErrorToast'

/** The project's link; only leaders can see it, so it only loads for them. */
export function useInvitation(projectId: number, enabled: boolean) {
  const { team } = useGateways()
  return useQuery({ queryKey: queryKeys.invitation(projectId), queryFn: () => team.getInvitation(projectId), enabled })
}

/** What an action on a member answers: `lastLeader` is said next to the action, not in a toast (contract, 409). */
export interface TeamOutcome {
  ok: boolean
  lastLeader?: string
}

export function useTeam(projectId: number) {
  const { team } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()
  const refetch = [queryKeys.project(projectId)]

  const onError = (error: unknown, failure: string): TeamOutcome => {
    if (hasCode(error, 'last_leader') && isApiError(error)) {
      void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
      return { ok: false, lastLeader: say('last_leader', error.body.detail) }
    }
    reportError(error, { failure, refetch })
    return { ok: false }
  }

  const setInvitation = (invitation: Invitation) => client.setQueryData(queryKeys.invitation(projectId), invitation)

  return {
    /** A leader's edit of one member's data. Resolves with the field errors to show. */
    async updateMember(memberId: number, body: MemberUpdate): Promise<FieldErrors> {
      const local = toFieldErrors(validateMemberUpdate(body))
      if (Object.keys(local).length) return local
      if (Object.keys(body).length === 0) return {}
      try {
        client.setQueryData(queryKeys.project(projectId), await team.updateMember(projectId, memberId, body))
        push({ tone: 'success', message: 'Cambios guardados.' })
        return {}
      } catch (error) {
        if (hasCode(error, 'last_leader')) return { '': onError(error, '').lastLeader ?? '' }
        return reportError(error, { failure: 'No se guardaron los cambios', form: true, refetch })
      }
    },

    /** Leader or member, without touching the rest of their data (no team_changed). */
    async setPermission(memberId: number, permission: MemberUpdate['permission']): Promise<TeamOutcome> {
      try {
        client.setQueryData(queryKeys.project(projectId), await team.updateMember(projectId, memberId, { permission }))
        push({ tone: 'success', message: permission === 'leader' ? 'Ahora es líder.' : 'Ahora es miembro.' })
        return { ok: true }
      } catch (error) {
        return onError(error, 'No se cambió el permiso')
      }
    },

    /** Removes someone, or yourself (leaving). Their pending tasks become unassigned. */
    async remove(memberId: number, { leaving = false } = {}): Promise<TeamOutcome> {
      try {
        await team.removeMember(projectId, memberId)
        void client.invalidateQueries({ queryKey: queryKeys.projects() })
        if (leaving) {
          // The project isn't yours any more: nothing of it should come back from the cache.
          client.removeQueries({ queryKey: queryKeys.project(projectId) })
          client.setQueryData<ProjectSummary[]>(queryKeys.projects(), (list) => list?.filter((p) => p.id !== projectId))
          push({ tone: 'success', message: 'Saliste del proyecto.' })
        } else {
          void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
          void client.invalidateQueries({ queryKey: queryKeys.board(projectId) })
          push({ tone: 'success', message: 'Quitaste a la persona del equipo.' })
        }
        return { ok: true }
      } catch (error) {
        return onError(error, leaving ? 'No saliste del proyecto' : 'No se quitó a la persona')
      }
    },

    /** A new link; the previous one stops working. Also turns invitations back on. */
    async renewInvitation(): Promise<boolean> {
      try {
        setInvitation(await team.renewInvitation(projectId))
        return true
      } catch (error) {
        reportError(error, { failure: 'No se creó el link', refetch: [queryKeys.invitation(projectId)] })
        return false
      }
    },

    async disableInvitation(): Promise<boolean> {
      try {
        await team.disableInvitation(projectId)
        setInvitation({ active: false, token: null })
        return true
      } catch (error) {
        reportError(error, { failure: 'No se desactivaron las invitaciones', refetch: [queryKeys.invitation(projectId)] })
        return false
      }
    },
  }
}

/** The invitation's preview, signed in or not (`already_member` is false without a session). */
export function useInvitationPreview(token: string) {
  const { team } = useGateways()
  const query = useQuery({
    queryKey: queryKeys.invitationPreview(token),
    queryFn: () => team.previewInvitation(token),
    retry: false,
  })
  return { ...query, invalid: hasCode(query.error, 'invitation_not_found') }
}

/** Joins with the link; resolves with the project to open, or the field errors to show. */
export function useJoin(token: string) {
  const { team } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()

  return useCallback(
    async (role: string): Promise<{ projectId: number } | { errors: FieldErrors }> => {
      try {
        const { project_id } = await team.join(token, role.trim() ? { role: role.trim() } : {})
        void client.invalidateQueries({ queryKey: queryKeys.projects() })
        return { projectId: project_id }
      } catch (error) {
        if (hasCode(error, 'invitation_not_found')) {
          void client.invalidateQueries({ queryKey: queryKeys.invitationPreview(token) })
          return { errors: {} }
        }
        return { errors: reportError(error, { failure: 'No te uniste al proyecto', form: true }) }
      }
    },
    [team, token, client, reportError],
  )
}
