// UC-01 + UC-02: create the project, start planning, and land on the planning screen.

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ProjectCreate } from '../../domain/project'
import type { FieldErrors } from '../../domain/rules'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useApiErrorToast } from './useApiErrorToast'

/** Resolves with the field errors to show, or navigates through `onCreated` when it worked. */
export function useCreateProject(onCreated: (projectId: number) => void) {
  const { projects, planning } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()

  return useCallback(
    async (body: ProjectCreate): Promise<FieldErrors> => {
      let projectId: number
      try {
        const project = await projects.create(body)
        projectId = project.id
        client.setQueryData(queryKeys.project(project.id), project)
        void client.invalidateQueries({ queryKey: queryKeys.projects() })
      } catch (error) {
        return reportError(error, { failure: 'No se creó el proyecto', form: true })
      }
      try {
        await planning.start(projectId)
        void client.invalidateQueries({ queryKey: queryKeys.project(projectId) })
      } catch (error) {
        // The project exists: the planning screen offers "Start planning" again.
        reportError(error, { failure: 'La planificación no empezó' })
      }
      onCreated(projectId)
      return {}
    },
    [projects, planning, client, reportError, onCreated],
  )
}
