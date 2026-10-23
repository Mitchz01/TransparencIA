import type { Gateways } from '../../application/ports'
import { httpActivityGateway } from './activityGateway'
import { httpBoardGateway } from './boardGateway'
import { httpDocumentGateway } from './documentGateway'
import { httpEventStream } from './eventStream'
import { httpIntegrationGateway } from './integrationGateway'
import { httpPlanningGateway } from './planningGateway'
import { httpProjectGateway } from './projectGateway'
import { httpProposalGateway } from './proposalGateway'

/** Gateways backed by the real API. Only app/container.tsx should import this. */
export function createHttpGateways(): Gateways {
  return {
    projects: httpProjectGateway,
    proposals: httpProposalGateway,
    activity: httpActivityGateway,
    events: httpEventStream,
    planning: httpPlanningGateway,
    board: httpBoardGateway,
    documents: httpDocumentGateway,
    integrations: httpIntegrationGateway,
  }
}
