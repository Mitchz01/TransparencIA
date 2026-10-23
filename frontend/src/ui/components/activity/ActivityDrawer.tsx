import { useActivityFeed } from '../../../application/liveUpdates'
import type { Actor } from '../../../domain/events'
import { timeAgo } from '../../format'
import { Drawer, EmptyState, Icon, SkeletonCard, type IconGlyph } from '../ds'
import { Activity01Icon, AiMagicIcon, GithubIcon, Settings01Icon, UserIcon } from '../ds/icons'

const ACTORS: Record<Actor, { icon: IconGlyph; label: string }> = {
  agent: { icon: AiMagicIcon, label: 'Agente' },
  person: { icon: UserIcon, label: 'Persona' },
  github: { icon: GithubIcon, label: 'GitHub' },
  system: { icon: Settings01Icon, label: 'Sistema' },
}

/** What's happening in the project, live, newest first. */
export function ActivityDrawer({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { data: events, isPending } = useActivityFeed(projectId)
  return (
    <Drawer title="Actividad" onClose={onClose}>
      {isPending ? (
        <SkeletonCard lines={4} />
      ) : !events?.length ? (
        <EmptyState icon={Activity01Icon} title="Todavía nada" className="bg-inset">
          Aquí aparecen los agentes, las personas y GitHub a medida que trabajan.
        </EmptyState>
      ) : (
        <ol className="grid gap-1">
          {events.map((event) => (
            <li key={event.seq} className="flex gap-3 rounded-md px-2 py-2.5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-strong text-ink-muted">
                <Icon icon={ACTORS[event.actor].icon} label={ACTORS[event.actor].label} size={16} />
              </span>
              <span className="grid min-w-0">
                <span className="text-label">{event.summary}</span>
                <time dateTime={event.occurred_at} className="text-caption text-ink-subtle">
                  {timeAgo(event.occurred_at)}
                </time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  )
}
