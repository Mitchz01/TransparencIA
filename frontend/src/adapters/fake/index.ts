import type { Gateways } from '../../application/ports'
import { fakeActivityGateway, fakeEventStream } from './activityGateway'
import { fakeBoardGateway } from './boardGateway'
import { fakeDocumentGateway } from './documentGateway'
import { createFakePlanning, type FakePlanning, type FakePlanningOptions } from './fakePlanning'
import { fakeIntegrationGateway } from './integrationGateway'
import { fakePlanningGateway } from './planningGateway'
import { fakeProjectGateway } from './projectGateway'
import { fakeProposalGateway } from './proposalGateway'
import { FakeStore, setFakeOffline } from './store'

export interface FakeBackend {
  gateways: Gateways
  store: FakeStore
  planning: FakePlanning
  /** Stops saving and drops the saved state; the next load starts from the demo seed. */
  forget: () => void
}

export interface FakeBackendOptions extends FakePlanningOptions {
  store?: FakeStore
  /** Keep the demo state across reloads in this storage (the browser's localStorage). */
  storage?: Storage
}

/** In-memory backend (no API) seeded with demo projects, with fake agents. Only app/container.tsx should import this. */
export function createFakeBackend({ store = new FakeStore(), storage, ...options }: FakeBackendOptions = {}): FakeBackend {
  let forgotten = false
  const save = () => storage && !forgotten && store.save(storage)
  if (storage) {
    store.restore(storage)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save())
  }
  const planning = createFakePlanning(store, options)
  if (storage) planning.resume()
  return {
    store,
    planning,
    forget() {
      forgotten = true
      if (storage) FakeStore.clear(storage)
    },
    gateways: {
      projects: fakeProjectGateway(store),
      proposals: fakeProposalGateway(store),
      activity: fakeActivityGateway(store),
      events: fakeEventStream(store),
      planning: fakePlanningGateway(planning),
      board: fakeBoardGateway(store, planning.replanAfterClosing),
      documents: fakeDocumentGateway(store, planning.regenerateDocument),
      integrations: fakeIntegrationGateway(store),
    },
  }
}

/** The fake gateways alone, for tests and stories. */
export const createFakeGateways = (options?: FakeBackendOptions): Gateways => createFakeBackend(options).gateways

export { FakeStore, setFakeOffline }
