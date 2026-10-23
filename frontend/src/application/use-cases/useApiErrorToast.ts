// The UI reaction to each error code (frontend/docs/api-contract.md, section 2).

import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { isApiError } from '../errors'
import { useToasts } from '../toasts'

export interface ErrorReaction {
  /** What failed, said first in the toast: "The move couldn't be saved". */
  failure?: string
  /** Offered as "Retry" when the call can simply be repeated (network, GitHub down). */
  retry?: () => void
  /** Refetched after a 404 or 409, because the state changed under the person. */
  refetch?: QueryKey[]
  /** The caller shows 422 field errors under its inputs; without a form they go to a toast. */
  form?: boolean
}

export type FieldErrors = Record<string, string>

export function useApiErrorToast() {
  const { push } = useToasts()
  const client = useQueryClient()

  return useCallback(
    (error: unknown, { failure, retry, refetch = [], form = false }: ErrorReaction = {}): FieldErrors => {
      const lead = (text: string) => (failure ? `${failure}. ${text}` : text)
      const refresh = () => refetch.forEach((queryKey) => void client.invalidateQueries({ queryKey }))
      const retryAction = retry ? { label: 'Retry', run: retry } : undefined

      if (!isApiError(error)) {
        console.error(error)
        push({ tone: 'error', message: lead('Something went wrong.') })
        return {}
      }
      const { status, code, body, requestId } = error

      if (status === 0) {
        push({ tone: 'error', message: lead('Can’t reach the server.'), action: retryAction, requestId })
      } else if (status === 502) {
        push({ tone: 'error', message: lead('GitHub isn’t answering, try again in a minute.'), action: retryAction, requestId })
      } else if (status === 404) {
        push({ tone: 'error', message: lead(body.detail), requestId })
        refresh()
      } else if (status === 409) {
        push({ tone: 'info', message: body.detail, requestId })
        refresh()
      } else if (status === 422 && code === 'validation_failed') {
        const fields = error.fieldErrors()
        if (!form || fields['']) push({ tone: 'error', message: fields[''] ?? lead(body.detail), requestId })
        return fields
      } else if (status === 422) {
        push({ tone: 'error', message: lead(body.detail), requestId })
      } else {
        if (status === 400) console.error('Malformed request', requestId, body)
        push({ tone: 'error', message: lead('Something went wrong.'), requestId })
      }
      return {}
    },
    [push, client],
  )
}
