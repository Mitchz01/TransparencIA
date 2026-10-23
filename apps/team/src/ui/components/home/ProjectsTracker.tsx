// The home's follow-up panel (spec 019): every project with its state, physical progress, money spent and
// traffic light, so an entity sees at a glance what needs attention. The numbers come from the backend's
// rules (spec 017); nothing is computed here.

import { useState, type Ref } from 'react'
import { Link } from 'react-router-dom'
import type { Light, TeamPortal } from '@agile/domain'
import { hasCode } from '../../../application/errors'
import { useTeamPortals } from '../../../application/use-cases/useTransparency'
import { recentProjects } from '../../../domain/launchpad'
import type { ProjectSummary } from '../../../domain/project'
import { formatDate, plural } from '../../format'
import { ButtonLink, EmptyState, Icon, ProgressTrack, Segmented, Skeleton, SkeletonCard, StateLabel, type Hue, type IconGlyph } from '@agile/ui'
import { Add01Icon, Alert02Icon, Calendar03Icon, Clock01Icon, CrownIcon, Folder01Icon, Search01Icon, Tick02Icon, UserGroupIcon, UserIcon } from '@agile/ui/icons'
import { PROJECT_STATUS } from '../project/projectStatus'

type Filter = 'all' | 'leading'

const FILTERS = [
  { value: 'all' as const, label: 'Todos' },
  { value: 'leading' as const, label: 'Los que lidero' },
]

const LIGHTS: Record<Light, { label: string; hue: Hue; icon: IconGlyph }> = {
  green: { label: 'En verde', hue: 'teal', icon: Tick02Icon },
  yellow: { label: 'En amarillo', hue: 'amber', icon: Alert02Icon },
  red: { label: 'En rojo', hue: 'coral', icon: Alert02Icon },
}

/** Public contracts are counted in months: 26 weeks read "6 meses". */
const durationLabel = (weeks: number) => {
  const months = Math.round((weeks * 12) / 52)
  return months >= 1 ? plural(months, 'mes', 'meses') : plural(weeks, 'semana')
}

const percent = (value: number) => `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

function Meter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="grid gap-1.5">
      <span className="flex items-baseline justify-between gap-3 text-caption text-ink-muted">
        {label}
        <span className="text-label text-ink tabular-nums">{value === null ? 'Sin actividades' : percent(value)}</span>
      </span>
      <ProgressTrack value={Math.min(value ?? 0, 100)} max={100} label={`${label}: ${value === null ? 'sin actividades' : percent(value)}`} over={(value ?? 0) > 100} />
    </div>
  )
}

/** The project's numbers, or what's missing to have them. */
function Progress({ project, portal, missingBudget, loading }: {
  project: ProjectSummary
  portal: TeamPortal | undefined
  missingBudget: boolean
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-3" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }
  if (portal) {
    const light = LIGHTS[portal.summary.light]
    return (
      <div className="grid gap-3">
        <Meter label="Avance de actividades" value={portal.summary.physical_pct} />
        <Meter label="Dinero ejecutado" value={portal.summary.spent_pct} />
        <StateLabel hue={light.hue} icon={light.icon}>{light.label}</StateLabel>
      </div>
    )
  }
  if (missingBudget) {
    return (
      <div className="grid content-center justify-items-start gap-2">
        <span className="text-caption text-ink-muted">Sin presupuesto cargado: aún no hay avance ni gasto para mostrar.</span>
        {project.permission === 'leader' && (
          <ButtonLink to={`/projects/${project.id}/transparency`} size="sm">Cargar presupuesto</ButtonLink>
        )}
      </div>
    )
  }
  return <span className="text-caption text-ink-muted">No se pudo cargar el avance.</span>
}

function ProjectRow({ project, portal, missingBudget, loading }: {
  project: ProjectSummary
  portal: TeamPortal | undefined
  missingBudget: boolean
  loading: boolean
}) {
  const status = PROJECT_STATUS[project.status]
  return (
    <li className="grid gap-5 rounded-lg bg-surface p-5 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] md:items-center md:gap-8">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link to={`/projects/${project.id}`} className="min-w-0 truncate text-heading hover:text-accent-ink" title={project.name}>
            {project.name}
          </Link>
          <StateLabel hue={status.hue} icon={status.icon}>{status.label}</StateLabel>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted tabular-nums">
          {project.permission === 'leader'
            ? <span className="inline-flex items-center gap-1.5 text-ink"><Icon icon={CrownIcon} size={16} />Líder</span>
            : <span className="inline-flex items-center gap-1.5 text-ink"><Icon icon={UserIcon} size={16} />Miembro</span>}
          <span className="inline-flex items-center gap-1.5"><Icon icon={Clock01Icon} size={16} />{durationLabel(project.duration_weeks)}</span>
          <span className="inline-flex items-center gap-1.5"><Icon icon={UserGroupIcon} size={16} />{plural(project.member_count, 'persona')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon icon={Calendar03Icon} size={16} />Registrado el {formatDate(project.created_at)}</span>
        </div>
      </div>
      <Progress project={project} portal={portal} missingBudget={missingBudget} loading={loading} />
    </li>
  )
}

interface ProjectsTrackerProps {
  projects: ProjectSummary[] | undefined
  isPending: boolean
  searchRef?: Ref<HTMLInputElement>
}

export function ProjectsTracker({ projects, isPending, searchRef }: ProjectsTrackerProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const ordered = recentProjects(projects ?? [])
  const portals = useTeamPortals(ordered.map((p) => p.id))
  const byId = new Map(ordered.map((p, i) => [p.id, portals[i]]))

  const term = query.trim().toLocaleLowerCase('es')
  const shown = ordered
    .filter((p) => filter === 'all' || p.permission === 'leader')
    .filter((p) => !term || p.name.toLocaleLowerCase('es').includes(term))

  if (isPending) {
    return (
      <div className="grid gap-3">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!ordered.length) {
    return (
      <EmptyState
        icon={Folder01Icon}
        title="Todavía no tienes proyectos"
        action={<ButtonLink to="/projects/new" variant="primary" icon={Add01Icon}>Registrar proyecto</ButtonLink>}
      >
        Registra el primero: cuenta qué se va a ejecutar y los agentes arman el plan de trabajo por etapas.
      </EmptyState>
    )
  }

  return (
    <section aria-label="Tus proyectos" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-0 flex-1 basis-full sm:max-w-72 sm:basis-auto">
          <span className="sr-only">Buscar proyectos</span>
          <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Buscar por nombre"
            onChange={(event) => setQuery(event.target.value)}
            className="h-control-md w-full rounded-pill bg-surface pr-4 pl-10 text-label text-ink"
          />
        </label>
        <div className="max-w-full overflow-x-auto">
          <Segmented label="Mostrar" options={FILTERS} value={filter} onChange={setFilter} />
        </div>
      </div>

      {shown.length ? (
        <ul className="grid gap-3">
          {shown.map((project) => {
            const portal = byId.get(project.id)
            return (
              <ProjectRow
                key={project.id}
                project={project}
                portal={portal?.data}
                missingBudget={hasCode(portal?.error, 'budget_missing')}
                loading={Boolean(portal?.isPending)}
              />
            )
          })}
        </ul>
      ) : (
        <p className="rounded-lg bg-surface px-5 py-8 text-center text-body text-ink-muted">
          {term ? `Ningún proyecto se llama "${query.trim()}".` : 'Todavía no lideras ningún proyecto.'}
        </p>
      )}
    </section>
  )
}
