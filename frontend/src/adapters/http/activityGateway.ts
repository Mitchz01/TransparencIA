import type { ActivityGateway } from '../../application/ports'
import type { DomainEvent } from '../../domain/events'
import { http } from './client'

export const httpActivityGateway: ActivityGateway = {
  list: (projectId, options = {}) =>
    http.get<DomainEvent[]>(`/projects/${projectId}/activity`, { before: options.before, limit: options.limit }),
}
