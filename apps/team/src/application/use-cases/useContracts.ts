// Spec 017, US7: read a contract so the project starts from it. The AI reading lives in the backend.

import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ContractReading } from '../../domain/contracts'
import { hasCode } from '../errors'
import { useGateways } from '../gateways'
import { useApiErrorToast } from './useApiErrorToast'

export type ContractProblem = 'unsupported_file' | 'agent_unavailable'

export type ContractOutcome = { ok: true; reading: ContractReading } | { ok: false; problem: ContractProblem | null }

export function useReadContract() {
  const { contracts } = useGateways()
  const reportError = useApiErrorToast()
  const mutation = useMutation({ mutationFn: (file: File) => contracts.read(file) })
  const read = useCallback(
    async (file: File): Promise<ContractOutcome> => {
      try {
        return { ok: true, reading: await mutation.mutateAsync(file) }
      } catch (error) {
        if (hasCode(error, 'unsupported_file')) return { ok: false, problem: 'unsupported_file' }
        if (hasCode(error, 'agent_unavailable')) return { ok: false, problem: 'agent_unavailable' }
        reportError(error, { failure: 'No se leyó el contrato' })
        return { ok: false, problem: null }
      }
    },
    [mutation, reportError],
  )
  return { read, reading: mutation.isPending }
}
