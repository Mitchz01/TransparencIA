// UC-01 (edit): change the project or auto-approve. The team changes on its own screen (useTeam, spec 015).

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ProjectUpdate } from '../../domain/project'
import type { FieldErrors } from '../../domain/rules'
import { hasCode } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useToasts } from '../toasts'
import { useApiErrorToast } from './useApiErrorToast'

export function useUpdateProject(projectId: number) {
  const { projects } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()
  const { push } = useToasts()

  return useCallback(
    async (update: ProjectUpdate): Promise<FieldErrors> => {
      if (Object.keys(update).length === 0) {
        push({ tone: 'info', message: 'No hay cambios para guardar.' })
        return {}
      }
      try {
        const project = await projects.update(projectId, update)
        client.setQueryData(queryKeys.project(projectId), project)
        void client.invalidateQueries({ queryKey: queryKeys.projects() })
        push({ tone: 'success', message: 'Cambios guardados.' })
        return {}
      } catch (error) {
        if (hasCode(error, 'methodology_locked')) {
          void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
          return { requested_methodology: 'La planificación ya empezó: la metodología no se puede cambiar.' }
        }
        return reportError(error, { failure: 'No se guardaron los cambios', form: true, refetch: [queryKeys.project(projectId)] })
      }
    },
    [projects, projectId, client, reportError, push],
  )
}
