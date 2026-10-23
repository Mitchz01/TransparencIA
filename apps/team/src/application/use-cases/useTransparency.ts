// Spec 017 (owner: P4): the project's budget, expenses with evidence, publication and alert answers.
// Every change refetches the team portal: its numbers come from the backend's rules, never from here.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { BudgetInput, Expense, ExpenseConfirmation } from '@agile/domain'
import { hasCode, isApiError } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { useApiErrorToast, type FieldErrors } from './useApiErrorToast'

// Spec 017's own error codes, in the UI's Spanish. They're handled here so a 502 from the evidence
// agent never reads as "GitHub no responde" (useApiErrorToast's generic 502).
const MESSAGES: Record<string, string> = {
  budget_missing: 'Primero guarda el presupuesto del proyecto.',
  expense_not_found: 'Ese gasto ya no existe.',
  expense_not_draft: 'Ese gasto ya se confirmó.',
  alert_not_found: 'Esa alerta ya no existe.',
  unsupported_file: 'Sube un PDF o una imagen (JPG, PNG o WebP) de hasta 10 MB.',
  agent_unavailable: 'No pudimos leer el documento.',
}

export const transparencyMessage = (code: string) => MESSAGES[code]

function useReport(projectId: number) {
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()
  return useCallback(
    (error: unknown, failure: string, form = false): FieldErrors => {
      const known = isApiError(error) ? MESSAGES[error.code] : undefined
      if (!known || !isApiError(error)) return reportError(error, { failure, form, refetch: [queryKeys.teamPortal(projectId)] })
      push({ tone: error.status === 409 ? 'info' : 'error', message: `${failure}. ${known}`, requestId: error.requestId })
      void client.invalidateQueries({ queryKey: queryKeys.budget(projectId) })
      void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) })
      return {}
    },
    [client, reportError, push, projectId],
  )
}

export function useBudget(projectId: number) {
  const { transparency } = useGateways()
  return useQuery({ queryKey: queryKeys.budget(projectId), queryFn: () => transparency.getBudget(projectId) })
}

/** The portal plus drafts. Only asked for once there's a budget (it answers 409 budget_missing before). */
export function useTeamPortal(projectId: number, enabled = true) {
  const { transparency } = useGateways()
  return useQuery({
    queryKey: queryKeys.teamPortal(projectId),
    queryFn: () => transparency.getTeamPortal(projectId),
    enabled,
  })
}

/** Resolves with the field errors to show under the editor, or {} when saved. */
export function useSetBudget(projectId: number) {
  const { transparency } = useGateways()
  const client = useQueryClient()
  const report = useReport(projectId)
  const { push } = useToasts()
  return useCallback(
    async (body: BudgetInput): Promise<FieldErrors> => {
      try {
        const budget = await transparency.setBudget(projectId, body)
        client.setQueryData(queryKeys.budget(projectId), budget)
        void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) })
        push({ tone: 'success', message: 'Presupuesto guardado.' })
        return {}
      } catch (error) {
        return report(error, 'No se guardó el presupuesto', true)
      }
    },
    [transparency, client, report, push, projectId],
  )
}

/** Why an upload didn't give a draft; the drop zone shows it in place instead of a toast. */
export type UploadProblem = 'unsupported_file' | 'agent_unavailable' | 'budget_missing'

export type UploadOutcome = { ok: true; draft: Expense } | { ok: false; problem: UploadProblem | null }

const UPLOAD_PROBLEMS: UploadProblem[] = ['unsupported_file', 'agent_unavailable', 'budget_missing']

export function useUploadEvidence(projectId: number) {
  const { transparency } = useGateways()
  const client = useQueryClient()
  const report = useReport(projectId)
  const mutation = useMutation({
    mutationFn: (file: File) => transparency.uploadEvidence(projectId, file),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) }),
  })
  const upload = useCallback(
    async (file: File): Promise<UploadOutcome> => {
      try {
        return { ok: true, draft: await mutation.mutateAsync(file) }
      } catch (error) {
        const problem = UPLOAD_PROBLEMS.find((code) => hasCode(error, code))
        if (problem) return { ok: false, problem }
        report(error, 'No se subió la evidencia')
        return { ok: false, problem: null }
      }
    },
    [mutation, report],
  )
  return { upload, uploading: mutation.isPending }
}

/** Resolves with the field errors to show in the review form, or {} when confirmed. */
export function useConfirmExpense(projectId: number) {
  const { transparency } = useGateways()
  const client = useQueryClient()
  const report = useReport(projectId)
  const { push } = useToasts()
  return useCallback(
    async (expenseId: number, body: ExpenseConfirmation): Promise<FieldErrors> => {
      try {
        const expense = await transparency.confirmExpense(projectId, expenseId, body)
        const rules = expense.alerts.filter((a) => a.source === 'rule').length
        push(
          rules
            ? { tone: 'info', message: `Gasto publicado con ${rules === 1 ? '1 alerta' : `${rules} alertas`} de las reglas.` }
            : { tone: 'success', message: 'Gasto publicado en el portal.' },
        )
        return {}
      } catch (error) {
        return report(error, 'No se confirmó el gasto', true)
      } finally {
        void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) })
      }
    },
    [transparency, client, report, push, projectId],
  )
}

export function useDiscardExpense(projectId: number) {
  const { transparency } = useGateways()
  const client = useQueryClient()
  const report = useReport(projectId)
  return useMutation({
    mutationFn: (expenseId: number) => transparency.discardExpense(projectId, expenseId),
    onError: (error) => report(error, 'No se descartó el borrador'),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) }),
  })
}

export function useSetPublication(projectId: number) {
  const { transparency } = useGateways()
  const client = useQueryClient()
  const report = useReport(projectId)
  return useMutation({
    mutationFn: (isPublic: boolean) => transparency.setPublication(projectId, isPublic),
    onError: (error) => report(error, 'No se cambió la publicación'),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) }),
  })
}

export function useAnswerAlert(projectId: number) {
  const { transparency } = useGateways()
  const client = useQueryClient()
  const report = useReport(projectId)
  const { push } = useToasts()
  return useMutation({
    mutationFn: ({ alertId, answer }: { alertId: number; answer: string }) => transparency.answerAlert(projectId, alertId, answer),
    onSuccess: () => push({ tone: 'success', message: 'Respuesta publicada en el portal.' }),
    onError: (error) => report(error, 'No se publicó la respuesta'),
    onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.teamPortal(projectId) }),
  })
}
