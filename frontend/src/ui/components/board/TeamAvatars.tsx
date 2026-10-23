import { Link } from 'react-router-dom'
import type { Member } from '../../../domain/project'
import { Avatar } from '../ds'

const SHOWN = 4

const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`)

/** Who works on the project: up to four sets of initials, then "+N", leading to the team (spec 014). */
export function TeamAvatars({ projectId, members }: { projectId: number; members: Member[] }) {
  if (members.length === 0) return null
  const rest = members.length - SHOWN
  return (
    <Link
      to={`/projects/${projectId}/settings`}
      aria-label={`Equipo: ${listNames(members.map((m) => m.name))}`}
      title="Ver el equipo"
      className="flex items-center rounded-pill p-1 transition-[background-color] duration-150 hover:bg-surface"
    >
      <span className="flex -space-x-1">
        {members.slice(0, SHOWN).map((m) => (
          <Avatar key={m.id} name={m.name} className="ring-2 ring-bg" />
        ))}
        {rest > 0 && (
          <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-pill bg-surface-strong text-caption font-semibold text-ink-muted ring-2 ring-bg tabular-nums">
            +{rest}
          </span>
        )}
      </span>
    </Link>
  )
}
