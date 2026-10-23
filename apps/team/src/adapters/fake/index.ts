import type { Gateways } from '../../application/ports'
import { guarded, guardedEvents, onDocument, onMember, onProject, onProposal, onSprint, onTask } from './access'
import { fakeActivityGateway, fakeEventStream } from './activityGateway'
import { fakeAuthGateway } from './authGateway'
import { fakeBoardGateway } from './boardGateway'
import { fakeDocumentGateway } from './documentGateway'
import { createFakePlanning, type FakePlanning, type FakePlanningOptions } from './fakePlanning'
import { fakeIntegrationGateway } from './integrationGateway'
import { fakePlanningGateway } from './planningGateway'
import { fakeProjectGateway } from './projectGateway'
import { fakeProposalGateway } from './proposalGateway'
import { FakeStore, setFakeOffline } from './store'
import { fakeTeamGateway } from './teamGateway'
import { fakeTransparencyGateway } from './transparencyGateway'

export interface FakeBackend {
  gateways: Gateways
  store: FakeStore
  planning: FakePlanning
  /** Stops saving and drops the saved state; the next load starts from the demo seed. */
  forget: () => void
  /** Demo helper: signs in as a demo account by name ("Ana", "Leo") and saves, so a reload keeps it. */
  signInAs: (name: string) => void
}

export interface FakeBackendOptions extends FakePlanningOptions {
  store?: FakeStore
  /** Keep the demo state across reloads in this storage (the browser's localStorage). */
  storage?: Storage
}

/** In-memory backend (no API) seeded with demo projects, with fake agents. Only app/container.tsx should import this.
 *  Every gateway runs the service's access checks first (access.ts): session, membership, leader actions. */
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
    signInAs(name) {
      store.signInAs(name)
      save()
    },
    gateways: {
      auth: fakeAuthGateway(store),
      team: guarded(store, fakeTeamGateway(store), {
        updateMember: (projectId) => onProject('manage')(projectId),
        removeMember: (projectId) => onProject('view')(projectId),
        getInvitation: onProject('manage'),
        renewInvitation: onProject('manage'),
        disableInvitation: onProject('manage'),
        previewInvitation: () => 'public',
        join: () => 'signed_in',
      }),
      projects: guarded(store, fakeProjectGateway(store), {
        create: () => 'signed_in',
        list: () => 'signed_in',
        get: onProject('view'),
        update: (id) => onProject('manage')(id),
        getPlanViews: onProject('view'),
      }),
      proposals: guarded(store, fakeProposalGateway(store), {
        list: (projectId) => onProject('view')(projectId),
        get: onProposal('view'),
        approve: onProposal('manage'),
        adjust: (id) => onProposal('manage')(id),
        reject: (id) => onProposal('manage')(id),
        retryApply: onProposal('manage'),
        approveMany: (projectId) => onProject('manage')(projectId),
      }),
      activity: guarded(store, fakeActivityGateway(store), { list: (projectId) => onProject('view')(projectId) }),
      events: guardedEvents(store, fakeEventStream(store)),
      planning: guarded(store, fakePlanningGateway(planning), {
        start: onProject('manage'),
        retryStage: (projectId) => onProject('manage')(projectId),
        replan: (projectId) => onProject('manage')(projectId),
      }),
      board: guarded(store, fakeBoardGateway(store, planning.replanAfterClosing), {
        getBoard: onProject('view'),
        updateTask: (taskId) => onTask('work')(taskId),
        createTask: (projectId) => onProject('work')(projectId),
        setChecklist: (taskId) => onTask('work')(taskId),
        setCapacity: (projectId) => onProject('manage')(projectId),
        closeSprint: onSprint('manage'),
      }),
      documents: guarded(store, fakeDocumentGateway(store, planning.regenerateDocument), {
        list: onProject('view'),
        get: (documentId) => onDocument('view')(documentId),
        regenerate: (documentId) => onDocument('manage')(documentId),
        save: (documentId) => onDocument('work')(documentId),
      }),
      integrations: guarded(store, fakeIntegrationGateway(store), {
        connect: (projectId) => onProject('manage')(projectId),
        disconnect: onProject('manage'),
        proposeIssues: onProject('manage'),
        setGithubUsername: (memberId) => onMember('manage')(memberId),
      }),
      // Spec 017: P4 adds the access checks inside its fake; the public one needs none.
      transparency: fakeTransparencyGateway(store),
    },
  }
}

/** The fake gateways alone, for tests and stories. */
export const createFakeGateways = (options?: FakeBackendOptions): Gateways => createFakeBackend(options).gateways

export { FakeStore, setFakeOffline }
