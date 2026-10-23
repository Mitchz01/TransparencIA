// The UI reaction to each error code (frontend/docs/api-contract.md, section 2).

import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { isApiError } from '../errors'
import { queryKeys } from '../queryKeys'
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

// The UI speaks Spanish (spec 009, FR-012); the service's `detail` may not, so known codes get their own words.
const CODE_MESSAGES: Record<string, string> = {
  project_not_found: 'Ese proyecto ya no existe.',
  task_not_found: 'Esa tarea ya no existe.',
  sprint_not_found: 'Ese sprint ya no existe.',
  member_not_found: 'Ese miembro ya no existe.',
  document_not_found: 'Ese documento ya no existe.',
  proposal_not_found: 'Esa propuesta ya no existe.',
  stage_not_found: 'Esa etapa no existe.',
  version_not_found: 'Esa versión no existe.',
  methodology_locked: 'La metodología no se puede cambiar: la planificación ya empezó.',
  planning_already_running: 'La planificación ya está en curso.',
  planning_not_startable: 'El plan ya está completo. Pide una replanificación.',
  stage_not_retryable: 'Esa etapa cambió de estado.',
  proposal_already_resolved: 'Esta propuesta ya se resolvió.',
  proposal_not_retryable: 'No hay nada que reintentar.',
  sprint_closed: 'Ese sprint está cerrado.',
  capacity_not_applicable: 'Este tablero no tiene sprints.',
  regeneration_in_progress: 'Ya se está regenerando.',
  version_conflict: 'Alguien guardó una versión más nueva.',
  repository_not_connected: 'Primero conecta un repo.',
  nothing_to_publish: 'Todas las tareas ya tienen su issue.',
  publication_pending: 'Ya hay una publicación esperando tu decisión.',
  plan_not_applied: 'Primero tiene que existir el tablero.',
  sprint_already_closed: 'Ese sprint ya está cerrado.',
  invalid_credentials: 'Email o contraseña incorrectos.',
  forbidden: 'Solo los líderes del proyecto pueden hacer esto.',
  invitation_not_found: 'Esta invitación ya no es válida. Pide al líder un link nuevo.',
  last_leader: 'El proyecto necesita un líder. Primero haz líder a otra persona.',
}

export const say = (code: string, detail: string) => CODE_MESSAGES[code] ?? detail

export function useApiErrorToast() {
  const { push } = useToasts()
  const client = useQueryClient()

  return useCallback(
    (error: unknown, { failure, retry, refetch = [], form = false }: ErrorReaction = {}): FieldErrors => {
      const lead = (text: string) => (failure ? `${failure}. ${text}` : text)
      const refresh = () => refetch.forEach((queryKey) => void client.invalidateQueries({ queryKey }))
      const retryAction = retry ? { label: 'Reintentar', run: retry } : undefined

      if (!isApiError(error)) {
        console.error(error)
        push({ tone: 'error', message: lead('Algo salió mal.') })
        return {}
      }
      const { status, code, body, requestId } = error

      if (status === 401 && code === 'not_authenticated') {
        // The session ended: application/session.ts already sends the person to sign in.
        return {}
      }
      if (status === 0) {
        push({ tone: 'error', message: lead('No hay conexión con el servidor.'), action: retryAction, requestId })
      } else if (status === 502) {
        push({ tone: 'error', message: lead('GitHub no responde, prueba de nuevo en un minuto.'), action: retryAction, requestId })
      } else if (status === 403) {
        // A member tried a leader action (spec 015): the screen shouldn't have offered it, so show what is true now.
        push({ tone: 'error', message: lead(say(code, body.detail)), requestId })
        void client.invalidateQueries({ queryKey: ['project'] })
        void client.invalidateQueries({ queryKey: queryKeys.projects() })
        refresh()
      } else if (status === 404) {
        push({ tone: 'error', message: lead(say(code, body.detail)), requestId })
        refresh()
      } else if (status === 409) {
        push({ tone: 'info', message: say(code, body.detail), requestId })
        refresh()
      } else if (status === 422 && code === 'validation_failed') {
        const fields = error.fieldErrors()
        if (!form || fields['']) push({ tone: 'error', message: fields[''] ?? lead(body.detail), requestId })
        return fields
      } else if (status === 422) {
        push({ tone: 'error', message: lead(say(code, body.detail)), requestId })
      } else {
        if (status === 400) console.error('Malformed request', requestId, body)
        push({ tone: 'error', message: lead('Algo salió mal.'), requestId })
      }
      return {}
    },
    [push, client],
  )
}
