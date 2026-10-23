// UC-02 to UC-05: follow the planning live and decide on each proposal.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { StageKey } from '../../domain/plan'
import type { Proposal } from '../../domain/proposals'
import { deriveStepper } from '../../domain/stepper'
import { hasCode } from '../errors'
import { useGateways } from '../gateways'
import { useActivityFeed } from '../liveUpdates'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { useApiErrorToast, type FieldErrors } from './useApiErrorToast'
import { useProject } from './useProjects'

export function useProposals(projectId: number) {
  const { proposals } = useGateways()
  return useQuery({ queryKey: queryKeys.proposals(projectId), queryFn: () => proposals.list(projectId) })
}

export function usePlanning(projectId: number) {
  const { planning } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const project = useProject(projectId)
  const proposals = useProposals(projectId)
  const activity = useActivityFeed(projectId)

  const steps = useMemo(
    () => (project.data && proposals.data ? deriveStepper(project.data, proposals.data, activity.data ?? []) : null),
    [project.data, proposals.data, activity.data],
  )

  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
    void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) })
  }

  const start = useMutation({
    mutationFn: () => planning.start(projectId),
    onSuccess: refresh,
    onError: (error) => {
      // Already running: the stepper is about to show it, nothing to tell.
      if (hasCode(error, 'planning_already_running')) return refresh()
      reportError(error, { failure: 'La planificación no empezó', retry: () => start.mutate(), refetch: [queryKeys.project(projectId)] })
    },
  })

  const retryStage = useMutation({
    mutationFn: (key: StageKey) => planning.retryStage(projectId, key),
    onSuccess: refresh,
    onError: (error, key) =>
      reportError(error, { failure: 'La etapa no se reinició', retry: () => retryStage.mutate(key), refetch: [queryKeys.proposals(projectId)] }),
  })

  return { project: project.data, steps, proposals: proposals.data, isPending: project.isPending || proposals.isPending, start, retryStage }
}

/** Approve, adjust or reject one proposal. Someone else may have decided first (another tab, auto-approve). */
export function useProposalActions(projectId: number) {
  const { proposals } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()

  const saved = (proposal: Proposal) => {
    client.setQueryData<Proposal[]>(queryKeys.proposals(projectId), (list) => list?.map((p) => (p.id === proposal.id ? proposal : p)))
    void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) })
    void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
  }

  const onError = (error: unknown, failure: string, retry?: () => void): FieldErrors => {
    if (hasCode(error, 'proposal_already_resolved')) {
      push({ tone: 'info', message: 'Esta propuesta ya se resolvió. Así quedó.' })
      void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) })
      return {}
    }
    return reportError(error, { failure, retry, form: true, refetch: [queryKeys.proposals(projectId)] })
  }

  const approve = useMutation({
    mutationFn: (id: number) => proposals.approve(id),
    onSuccess: saved,
    onError: (error, id) => onError(error, 'No se guardó la aprobación', () => approve.mutate(id)),
  })

  const retryApply = useMutation({
    mutationFn: (id: number) => proposals.retryApply(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) }),
    onError: (error, id) => onError(error, 'No se pudo volver a aplicar', () => retryApply.mutate(id)),
  })

  /** Resolve with the field errors (paths without "content."), or {} when it worked. */
  const adjust = async (id: number, content: Record<string, unknown>): Promise<FieldErrors> => {
    try {
      saved(await proposals.adjust(id, content))
      return {}
    } catch (error) {
      const fields = onError(error, 'No se guardaron tus cambios')
      return Object.fromEntries(Object.entries(fields).map(([path, message]) => [path.replace(/^content\.?/, ''), message]))
    }
  }

  const reject = async (id: number, reason: string): Promise<FieldErrors> => {
    try {
      saved(await proposals.reject(id, reason))
      return {}
    } catch (error) {
      return onError(error, 'No se guardó el rechazo')
    }
  }

  return { approve, adjust, reject, retryApply }
}
