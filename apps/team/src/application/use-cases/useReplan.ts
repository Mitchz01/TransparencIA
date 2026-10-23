// UC-15: ask for a replan with a reason, review its changes and drop some, close a sprint (spec 008).

import { useQueryClient } from '@tanstack/react-query'
import type { FieldErrors } from '../../domain/rules'
import type { ReplanContent } from '../../domain/proposalContent'
import { hasCode } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { useApiErrorToast } from './useApiErrorToast'
import { useProposals } from './usePlanning'

export function useReplan(projectId: number) {
  const { planning, board } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()

  return {
    async replan(reason: string): Promise<FieldErrors> {
      try {
        const { supersedes } = await planning.replan(projectId, reason)
        push({ tone: 'info', message: supersedes ? 'Pediste otro replan: reemplaza al que estaba esperando.' : 'El replanificador está revisando el tablero. Te propone los cambios en unos segundos.' })
        void client.invalidateQueries({ queryKey: queryKeys.proposals(projectId) })
        return {}
      } catch (error) {
        return reportError(error, { failure: 'No se pidió el replan', form: true })
      }
    },

    async closeSprint(sprintId: number) {
      try {
        const result = await board.closeSprint(sprintId)
        void client.invalidateQueries({ queryKey: queryKeys.board(projectId) })
        push({
          tone: 'success',
          message: result.pending_task_keys.length
            ? `${result.sprint.name} cerrado. Quedaron ${result.pending_task_keys.length} tareas: se propone un replan para que decidas.`
            : `${result.sprint.name} cerrado con todo terminado.`,
        })
        return true
      } catch (error) {
        if (hasCode(error, 'sprint_already_closed')) void client.invalidateQueries({ queryKey: queryKeys.board(projectId) })
        reportError(error, { failure: 'No se cerró el sprint' })
        return false
      }
    },
  }
}

/** The replan waiting for the leader, if any. */
export function usePendingReplan(projectId: number) {
  const proposals = useProposals(projectId)
  const proposal = (proposals.data ?? []).find((p) => p.kind === 'replan' && p.status === 'pending')
  return proposal ? { proposal, content: proposal.content as unknown as ReplanContent } : null
}
