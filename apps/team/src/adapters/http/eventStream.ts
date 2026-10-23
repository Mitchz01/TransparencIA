// GET /api/projects/{id}/events with EventSource (apps/team/docs/api-contract.md, section 5).
// On reconnect EventSource sends Last-Event-ID by itself and the server replays what was missed.

import type { EventStream } from '../../application/ports'
import { EVENT_TYPES, type DomainEvent } from '../../domain/events'
import { apiUrl } from './client'

export const httpEventStream: EventStream = {
  subscribe(projectId, onEvent, options = {}) {
    const source = new EventSource(apiUrl(`/projects/${projectId}/events`, { after: options.after }))

    const handle = (message: MessageEvent<string>) => {
      try {
        onEvent(JSON.parse(message.data) as DomainEvent)
      } catch {
        // A malformed message is skipped; the next refetch brings the state back.
      }
    }
    // The server sends `event: <type>`, so each known type needs its own listener.
    // Types this list doesn't know (added by newer specs) are ignored, as the contract asks.
    for (const type of EVENT_TYPES) source.addEventListener(type, handle)
    if (options.onError) source.addEventListener('error', options.onError)

    return () => source.close()
  },
}
