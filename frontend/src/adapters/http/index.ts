import type { Gateways } from '../../application/ports'
import { httpActivityGateway } from './activityGateway'
import { httpEventStream } from './eventStream'
import { httpProjectGateway } from './projectGateway'
import { httpProposalGateway } from './proposalGateway'

/** Gateways backed by the real API. Only app/container.tsx should import this. */
export function createHttpGateways(): Gateways {
  return {
    projects: httpProjectGateway,
    proposals: httpProposalGateway,
    activity: httpActivityGateway,
    events: httpEventStream,
  }
}
