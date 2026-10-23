import type { Gateways } from '../../application/ports'
import { httpActivityGateway } from './activityGateway'
import { httpAuthGateway } from './authGateway'
import { httpBoardGateway } from './boardGateway'
import { httpDocumentGateway } from './documentGateway'
import { httpEventStream } from './eventStream'
import { httpIntegrationGateway } from './integrationGateway'
import { httpPlanningGateway } from './planningGateway'
import { httpProjectGateway } from './projectGateway'
import { httpProposalGateway } from './proposalGateway'
import { httpTeamGateway } from './teamGateway'

/** Gateways backed by the real API. Only app/container.tsx should import this. */
export function createHttpGateways(): Gateways {
  return {
    auth: httpAuthGateway,
    team: httpTeamGateway,
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
