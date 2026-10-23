// UC-13: connect the GitHub repo, set the members' users and publish the tasks as issues (spec 007).

import { useQueryClient } from '@tanstack/react-query'
import type { ConnectRequest } from '../../domain/integrations'
import type { FieldErrors } from '../../domain/rules'
import { hasCode, isApiError } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { useApiErrorToast } from './useApiErrorToast'
import { useProposals } from './usePlanning'

const REASONS: Record<string, string> = {
  not_found: 'El repo no existe. Revisa el dueño y el nombre.',
  forbidden: 'El token no ve este repo. Dale acceso o usa otro token.',
  missing_permissions: 'El token necesita permisos de issues, pull requests y webhooks.',
}

export function useIntegrations(projectId: number) {
  const { integrations } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
    void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) })
  }

  return {
    async connect(body: ConnectRequest): Promise<FieldErrors> {
      try {
        const connection = await integrations.connect(projectId, body)
        refresh()
        push({ tone: 'success', message: connection.replaced ? `Repo cambiado: antes era ${connection.replaced}.` : `Repo conectado: ${connection.repository}.` })
        return {}
      } catch (error) {
        if (hasCode(error, 'repository_not_accessible') && isApiError(error)) {
          return { repository: REASONS[String(error.body.reason)] ?? 'GitHub no deja usar este repo.' }
        }
        return reportError(error, { failure: 'No se conectó el repo', form: true })
      }
    },

    async disconnect() {
      try {
        await integrations.disconnect(projectId)
        refresh()
        push({ tone: 'success', message: 'Repo desconectado.' })
      } catch (error) {
        reportError(error, { failure: 'No se desconectó el repo', refetch: [queryKeys.project(projectId)] })
      }
    },

    async proposeIssues(): Promise<number | null> {
      try {
        const { proposal_id, task_count } = await integrations.proposeIssues(projectId)
        refresh()
        push({ tone: 'info', message: `Propuesta lista: ${task_count} issues para publicar. Revísala y apruébala.` })
        return proposal_id
      } catch (error) {
        if (hasCode(error, 'nothing_to_publish')) {
          push({ tone: 'info', message: 'Todas las tareas ya tienen su issue.' })
          return null
        }
        if (hasCode(error, 'publication_pending') && isApiError(error)) return Number(error.body.proposal_id)
        reportError(error, { failure: 'No se armó la publicación', refetch: [queryKeys.project(projectId)] })
        return null
      }
    },

    /** Resolves with a warning when the user can't see the repo yet, or the field error. */
    async setGithubUsername(memberId: number, username: string | null): Promise<{ errors: FieldErrors; warning?: string }> {
      try {
        const { has_access } = await integrations.setGithubUsername(memberId, username)
        void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
        const warning = has_access === false ? 'Guardado, pero todavía no ve el repo.' : has_access === null && username ? 'Guardado. No se pudo verificar si ve el repo.' : undefined
        return { errors: {}, warning }
      } catch (error) {
        return { errors: reportError(error, { failure: 'No se guardó el usuario', form: true }) }
      }
    },
  }
}

/** GitHub actions waiting for the leader: publishing issues and review requests. */
export function useGithubProposals(projectId: number) {
  const proposals = useProposals(projectId)
  return (proposals.data ?? []).filter((p) => p.kind === 'github_action' && p.status === 'pending')
}
