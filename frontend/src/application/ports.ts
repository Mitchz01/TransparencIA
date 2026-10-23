// Puertos del front: la UI depende de estas interfaces, no de fetch.
// Los implementan adapters/http (backend real) y adapters/fake (sin backend).

import type { DomainEvent } from '../domain/events'

export interface EventStream {
  subscribe(projectId: number, onEvent: (event: DomainEvent) => void): () => void
}

// ProjectGateway, PlanningGateway, ProposalGateway, BoardGateway y DocumentGateway
// se agregan con la spec de cada feature (001-008).
