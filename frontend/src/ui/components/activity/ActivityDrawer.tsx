import { useState } from 'react'
import { ACTIVITY_PAGE, useActivityFeed, useActivityHistory } from '../../../application/liveUpdates'
import { Button, Drawer, EmptyState, SkeletonCard } from '../ds'
import { Activity01Icon } from '../ds/icons'
import { ActivityItem } from './ActivityItem'

/** What's happening in the project: live at the top, the history below on demand (spec 005). */
export function ActivityDrawer({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { data: live, isPending } = useActivityFeed(projectId)
  const [wantsMore, setWantsMore] = useState(false)
  const oldest = live && live.length >= ACTIVITY_PAGE ? live[live.length - 1].seq : undefined
  const history = useActivityHistory(projectId, oldest, wantsMore)
  const older = history.data?.pages.flat() ?? []
  const events = [...(live ?? []), ...older.filter((e) => !live?.some((l) => l.seq === e.seq))]
  const hasMore = oldest !== undefined && (!wantsMore || history.hasNextPage)

  return (
    <Drawer title="Actividad" onClose={onClose}>
      {isPending ? (
        <SkeletonCard lines={4} />
      ) : events.length === 0 ? (
        <EmptyState icon={Activity01Icon} title="Todavía nada" className="bg-inset">
          Aquí aparecen los agentes, las personas y GitHub a medida que trabajan.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          <ol className="grid gap-1" aria-live="polite">
            {events.map((event) => (
              <li key={event.seq}>
                <ActivityItem event={event} onOpen={onClose} />
              </li>
            ))}
          </ol>
          {hasMore && (
            <div>
              <Button
                size="sm"
                loading={history.isFetching}
                onClick={() => (wantsMore ? history.fetchNextPage() : setWantsMore(true))}
              >
                Ver anteriores
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
