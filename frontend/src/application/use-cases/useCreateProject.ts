// UC-01 (spec 015): create the project with you as its leader. Planning waits for the team: the
// leader shares the link first and starts planning from the planning screen.

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ProjectCreate } from '../../domain/project'
import type { FieldErrors } from '../../domain/rules'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'
import { useApiErrorToast } from './useApiErrorToast'

/** Resolves with the field errors to show, or navigates through `onCreated` when it worked. */
export function useCreateProject(onCreated: (projectId: number) => void) {
  const { projects } = useGateways()
  const client = useQueryClient()
  const reportError = useApiErrorToast()

  return useCallback(
    async (body: ProjectCreate): Promise<FieldErrors> => {
      try {
        const project = await projects.create(body)
        client.setQueryData(queryKeys.project(project.id), project)
        void client.invalidateQueries({ queryKey: queryKeys.projects() })
        onCreated(project.id)
        return {}
      } catch (error) {
        return reportError(error, { failure: 'No se creó el proyecto', form: true })
      }
    },
    [projects, client, reportError, onCreated],
  )
}
