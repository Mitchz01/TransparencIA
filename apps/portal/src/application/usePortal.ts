import { useQuery } from '@tanstack/react-query'
import { useGateway } from './gateway'

/** The published portal of a project; fails with ApiError 404 project_not_found when it isn't public. */
export function usePortal(slug: string) {
  const gateway = useGateway()
  return useQuery({ queryKey: ['portal', slug], queryFn: () => gateway.getPortal(slug) })
}
