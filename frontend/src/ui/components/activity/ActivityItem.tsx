import { Link } from 'react-router-dom'
import type { Actor, DomainEvent } from '../../../domain/events'
import { timeAgo } from '../../format'
import { cn, Icon, type IconGlyph } from '../ds'
import { AiMagicIcon, ArrowRight01Icon, GithubIcon, Settings01Icon, UserIcon } from '../ds/icons'

const ACTORS: Record<Actor, { icon: IconGlyph; label: string }> = {
  agent: { icon: AiMagicIcon, label: 'Agente' },
  person: { icon: UserIcon, label: 'Persona' },
  github: { icon: GithubIcon, label: 'GitHub' },
  system: { icon: Settings01Icon, label: 'Sistema' },
}

/** Where an event points: the proposal, the task, the sprint or the document it's about. */
export function activityLink(event: DomainEvent): string | null {
  const base = `/projects/${event.project_id}`
  if (!event.ref) return null
  switch (event.ref.kind) {
    case 'proposal': {
      const kind = 'kind' in event ? event.kind : 'plan_stage'
      if (kind === 'document') return `${base}/documents?proposal=${event.ref.id}`
      if (kind === 'github_action') return `${base}/integrations?proposal=${event.ref.id}`
      if (kind === 'replan') return `${base}/board?proposal=${event.ref.id}`
      return `${base}/planning?proposal=${event.ref.id}`
    }
    case 'task':
      return `${base}/board?task=${event.ref.id}`
    case 'sprint':
      return `${base}/board?sprint=${event.ref.id}`
    case 'document':
      return `${base}/documents?doc=${event.ref.id}`
    case 'project':
      return event.type === 'plan_applied' ? `${base}/board` : `${base}/planning`
    default:
      return null
  }
}

/** Who did it, what happened in one line, and when. Selecting it opens what it's about. */
export function ActivityItem({ event, onOpen }: { event: DomainEvent; onOpen?: () => void }) {
  const actor = ACTORS[event.actor]
  const link = activityLink(event)
  const body = (
    <>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-strong text-ink-muted">
        <Icon icon={actor.icon} label={actor.label} size={16} />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="text-label">{event.summary}</span>
        <time dateTime={event.occurred_at} className="text-caption text-ink-subtle">
          {timeAgo(event.occurred_at)}
        </time>
      </span>
      {link && <Icon icon={ArrowRight01Icon} size={16} className="mt-2 text-ink-subtle" />}
    </>
  )
  const box = 'flex gap-3 rounded-md px-2 py-2.5'
  return link ? (
    <Link to={link} onClick={onOpen} className={cn(box, 'transition-[background-color] duration-150 hover:bg-inset')}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}
