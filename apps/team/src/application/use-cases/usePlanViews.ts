// UC-07: the roadmap, methodology and architecture of a project, in one request (spec 004).

import { useQuery } from '@tanstack/react-query'
import { useGateways } from '../gateways'
import { queryKeys } from '../queryKeys'

export function usePlanViews(projectId: number) {
  const { projects } = useGateways()
  return useQuery({ queryKey: queryKeys.planViews(projectId), queryFn: () => projects.getPlanViews(projectId) })
}
