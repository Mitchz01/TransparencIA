// Frontend ports: the UI depends on these interfaces, not on fetch.
// adapters/http (real backend) and adapters/fake (no backend) implement them.

import type { DomainEvent } from '../domain/events'

export interface EventStream {
  subscribe(projectId: number, onEvent: (event: DomainEvent) => void): () => void
}

// ProjectGateway, PlanningGateway, ProposalGateway, BoardGateway and DocumentGateway
// are added with each feature's spec (001-008).
