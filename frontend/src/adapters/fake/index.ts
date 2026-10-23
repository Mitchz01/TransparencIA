import type { Gateways } from '../../application/ports'
import { fakeActivityGateway, fakeEventStream } from './activityGateway'
import { fakeProjectGateway } from './projectGateway'
import { fakeProposalGateway } from './proposalGateway'
import { FakeStore } from './store'

/** In-memory gateways (no backend), seeded with a demo project. Only app/container.tsx should import this. */
export function createFakeGateways(store = new FakeStore()): Gateways {
  return {
    projects: fakeProjectGateway(store),
    proposals: fakeProposalGateway(store),
    activity: fakeActivityGateway(store),
    events: fakeEventStream(store),
  }
}

export { FakeStore }
