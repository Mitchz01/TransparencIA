import { useQuery } from '@tanstack/react-query'
import { hasCode } from '../errors'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'

export function useProjects() {
  const { projects } = useGateways()
  return useQuery({ queryKey: queryKeys.projects(), queryFn: () => projects.list() })
}

export function useProject(projectId: number) {
  const { projects } = useGateways()
  const query = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projects.get(projectId),
    enabled: Number.isInteger(projectId),
  })
  return { ...query, notFound: !Number.isInteger(projectId) || hasCode(query.error, 'project_not_found') }
}
