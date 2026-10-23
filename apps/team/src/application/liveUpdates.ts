// Keeps every project screen up to date from the project's event stream, without polling
// (spec 009, FR-006). Each event invalidates what it changed, as the contract's
// "What to refetch per event" table says, and lands at the top of the activity feed.

import { useInfiniteQuery, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { DomainEvent } from '../domain/events'
import { useGateways } from './gateways'
import { queryKeys } from './queryKeys'

export const ACTIVITY_PAGE = 50

/** What to refetch for one event. `null` means everything the page shows (`resync`). */
export function keysForEvent(event: DomainEvent): QueryKey[] | null {
  const id = event.project_id
  switch (event.type) {
    case 'resync':
      return null
    case 'agent_started':
    case 'agent_finished':
    case 'stage_needs_leader':
    case 'plan_failed':
      return [queryKeys.project(id), queryKeys.proposals(id)]
    case 'plan_completed':
      return [queryKeys.project(id), queryKeys.proposals(id), queryKeys.planViews(id), queryKeys.projects()]
    case 'proposal_created':
    case 'proposal_resolved':
    case 'proposal_apply_failed':
      return [queryKeys.proposals(id), queryKeys.proposal(event.proposal_id), queryKeys.planViews(id), queryKeys.project(id)]
    case 'team_changed':
      // Someone leaving also unassigns their pending tasks (spec 015).
      return [queryKeys.project(id), queryKeys.projects(), queryKeys.board(id)]
    case 'plan_applied':
    case 'replan_applied':
      return [queryKeys.board(id), queryKeys.planViews(id), queryKeys.project(id)]
    case 'task_created':
    case 'task_status_changed':
    case 'task_updated':
    case 'objective_closed':
    case 'sprint_closed':
      return [queryKeys.board(id), queryKeys.planViews(id)]
    case 'documents_generated':
      return [queryKeys.documents(id), ['document']]
    case 'issues_published':
      return [queryKeys.board(id), queryKeys.proposal(event.proposal_id), queryKeys.proposals(id)]
    default:
      return []
  }
}

/** Adds an event to the top of the cached feed, once. */
export function prependEvent(client: QueryClient, event: DomainEvent) {
  client.setQueryData<DomainEvent[]>(queryKeys.activity(event.project_id), (feed) =>
    feed && !feed.some((e) => e.seq === event.seq) ? [event, ...feed] : feed,
  )
}

export function applyEvent(client: QueryClient, event: DomainEvent) {
  if (event.type !== 'resync') prependEvent(client, event)
  const keys = keysForEvent(event)
  if (keys === null) {
    void client.invalidateQueries()
    return
  }
  for (const queryKey of keys) void client.invalidateQueries({ queryKey })
}

/** The newest events of a project (the feed and the stepper read them). */
export function useActivityFeed(projectId: number) {
  const { activity } = useGateways()
  return useQuery({
    queryKey: queryKeys.activity(projectId),
    queryFn: () => activity.list(projectId, { limit: ACTIVITY_PAGE }),
    staleTime: Infinity, // the stream keeps it fresh
  })
}

/** Opens the event stream while a project screen is mounted, starting after the newest loaded event. */
export function useLiveUpdates(projectId: number) {
  const { events } = useGateways()
  const client = useQueryClient()
  const ready = useActivityFeed(projectId).isSuccess

  useEffect(() => {
    if (!ready) return
    const after = client.getQueryData<DomainEvent[]>(queryKeys.activity(projectId))?.[0]?.seq ?? 0
    return events.subscribe(projectId, (event) => applyEvent(client, event), { after })
  }, [events, client, projectId, ready])
}

/** Older events, page by page, below the live feed. Each page starts before the oldest one already shown. */
export function useActivityHistory(projectId: number, oldestLoaded: number | undefined, enabled: boolean) {
  const { activity } = useGateways()
  return useInfiniteQuery({
    queryKey: [...queryKeys.activity(projectId), 'history', oldestLoaded],
    queryFn: ({ pageParam }) => activity.list(projectId, { before: pageParam, limit: ACTIVITY_PAGE }),
    initialPageParam: oldestLoaded ?? 0,
    getNextPageParam: (page) => (page.length < ACTIVITY_PAGE ? undefined : page[page.length - 1].seq),
    enabled: enabled && oldestLoaded !== undefined, // only when the person asks for more
    staleTime: Infinity,
  })
}
