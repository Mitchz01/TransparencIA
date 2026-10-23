import type { ActivityGateway, EventStream } from '../../application/ports'
import { type FakeStore, invalid, notFound, reply } from './store'

export function fakeActivityGateway(store: FakeStore): ActivityGateway {
  return {
    async list(projectId, { before, limit = 50 } = {}) {
      if (!store.projects.has(projectId)) notFound('project', projectId)
      if (limit < 1 || limit > 200) invalid([{ field: 'limit', message: 'Must be between 1 and 200.' }])
      const events = store.events
        .filter((e) => e.project_id === projectId && (before === undefined || e.seq < before))
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
      return reply(events)
    },
  }
}

export function fakeEventStream(store: FakeStore): EventStream {
  return {
    subscribe(projectId, onEvent, { after } = {}) {
      if (after !== undefined) {
        for (const event of store.events) if (event.project_id === projectId && event.seq > after) onEvent(event)
      }
      return store.subscribe(projectId, onEvent)
    },
  }
}
