import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useGateway } from './gateway'

/** The portal's home (spec 017, US8). Keeps the last results on screen while the next search arrives. */
export function useProjectSearch(query: string) {
  const gateway = useGateway()
  const q = query.trim()
  return useQuery({ queryKey: ['projects', q], queryFn: () => gateway.searchProjects(q), placeholderData: keepPreviousData })
}
