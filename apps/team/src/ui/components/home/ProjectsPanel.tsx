import { useId, useState, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { recentProjects } from '../../../domain/launchpad'
import type { ProjectSummary } from '../../../domain/project'
import { formatDate, plural } from '../../format'
import { AgentSpark, Button, Icon, Pill, Segmented, SkeletonCard, type IconGlyph } from '@agile/ui'
import { ArrowRight02Icon, Calendar03Icon, Clock01Icon, CrownIcon, Search01Icon, UserGroupIcon, UserIcon } from '@agile/ui/icons'
import { PROJECT_STATUS } from '../project/projectStatus'
import { cover } from './cover'
import { TEMPLATES } from './templates'

type Tab = 'recent' | 'leading' | 'templates'

const TABS = [
  { value: 'recent' as const, label: 'Recientes' },
  { value: 'leading' as const, label: 'Lidero' },
  { value: 'templates' as const, label: 'Plantillas' },
]

const FIRST = 6

const GRID = 'grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3'

/** A generated cover: a small mesh from the seed with the agents' mark, lighter under the pointer. */
function Cover({ seed, icon }: { seed: number | string; icon?: IconGlyph }) {
  const { background, spark } = cover(seed)
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-md" style={{ background }} aria-hidden="true">
      <span className="absolute -translate-x-1/2 -translate-y-1/2 text-on-mesh opacity-50" style={{ left: `${spark.x}%`, top: `${spark.y}%`, rotate: `${spark.rotate}deg` }}>
        <AgentSpark variant="line" size={160} />
      </span>
      {icon && (
        <span className="absolute bottom-3 left-3 inline-flex size-10 items-center justify-center rounded-sm bg-surface text-ink">
          <Icon icon={icon} />
        </span>
      )}
      <span className="absolute inset-0 bg-on-mesh opacity-0 transition-opacity duration-150 group-hover:opacity-15" />
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const status = PROJECT_STATUS[project.status]
  return (
    <Link to={`/projects/${project.id}`} className="group grid content-start gap-3 rounded-lg">
      <Cover seed={project.id} />
      <div className="grid gap-2 px-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate text-heading" title={project.name}>{project.name}</h3>
          <Pill hue={status.hue} icon={status.icon}>{status.label}</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted tabular-nums">
          {project.permission === 'leader'
            ? <span className="inline-flex items-center gap-1.5 text-ink"><Icon icon={CrownIcon} size={16} />Líder</span>
            : <span className="inline-flex items-center gap-1.5 text-ink"><Icon icon={UserIcon} size={16} />Miembro</span>}
          <span className="inline-flex items-center gap-1.5"><Icon icon={Clock01Icon} size={16} />{plural(project.duration_weeks, 'semana')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon icon={UserGroupIcon} size={16} />{plural(project.member_count, 'miembro')}</span>
          <span className="inline-flex items-center gap-1.5"><Icon icon={Calendar03Icon} size={16} />{formatDate(project.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function Templates({ onPick }: { onPick: (description: string) => void }) {
  return (
    <ul className={GRID}>
      {TEMPLATES.map((template) => (
        <li key={template.key} className="grid">
          <button type="button" onClick={() => onPick(template.description)} className="group grid content-start gap-3 rounded-lg text-left">
            <Cover seed={template.key} icon={template.icon} />
            <span className="grid gap-1 px-1">
              <span className="text-heading">{template.name}</span>
              <span className="text-caption text-ink-muted">{template.summary}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

interface ProjectsPanelProps {
  projects: ProjectSummary[] | undefined
  isPending: boolean
  /** A template was picked: fill the box above with its description. */
  onTemplate: (description: string) => void
  searchRef?: Ref<HTMLInputElement>
  id?: string
}

/** The projects below the hero (spec 016, US2): recent ones, the ones you lead, or templates to start from. */
export function ProjectsPanel({ projects, isPending, onTemplate, searchRef, id }: ProjectsPanelProps) {
  const [tab, setTab] = useState<Tab>('recent')
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const titleId = useId()
  const hasProjects = Boolean(projects?.length)

  const term = query.trim().toLocaleLowerCase('es')
  const ordered = recentProjects(projects ?? []).filter((p) => tab !== 'leading' || p.permission === 'leader')
  const matching = term ? ordered.filter((p) => p.name.toLocaleLowerCase('es').includes(term)) : ordered
  const shown = term || all ? matching : matching.slice(0, FIRST)

  const body = () => {
    if (isPending) {
      return (
        <div className={GRID}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )
    }
    if (!hasProjects) {
      return (
        <div className="grid gap-5">
          <div className="grid gap-1">
            <h3 className="text-heading">Todavía no hay proyectos</h3>
            <p className="text-body text-ink-muted">Empieza con una plantilla o describe tu idea arriba.</p>
          </div>
          <Templates onPick={onTemplate} />
        </div>
      )
    }
    if (tab === 'templates') return <Templates onPick={onTemplate} />
    if (!shown.length) {
      return (
        <p className="rounded-md bg-inset px-5 py-8 text-center text-body text-ink-muted">
          {term ? `Ningún proyecto se llama "${query.trim()}".` : 'Todavía no lideras ningún proyecto.'}
        </p>
      )
    }
    return (
      <ul className={GRID}>
        {shown.map((project) => (
          <li key={project.id} className="grid">
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section id={id} aria-labelledby={titleId} className="relative grid scroll-mt-6 gap-6 rounded-xl bg-surface p-4 sm:p-6">
      <h2 id={titleId} className="sr-only">Tus proyectos</h2>
      {hasProjects && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex min-w-0 flex-1 basis-full sm:max-w-64 sm:basis-auto">
            <span className="sr-only">Buscar proyectos</span>
            <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Buscar"
              onChange={(event) => {
                setQuery(event.target.value)
                if (tab === 'templates') setTab('recent')
              }}
              className="h-control-md w-full rounded-pill bg-inset pr-4 pl-10 text-label text-ink"
            />
          </label>
          <div className="max-w-full overflow-x-auto">
            <Segmented label="Mostrar" inset options={TABS} value={tab} onChange={setTab} />
          </div>
          {tab !== 'templates' && !term && !all && matching.length > FIRST && (
            <Button variant="quiet" className="ml-auto" onClick={() => setAll(true)}>
              Ver todos
              <Icon icon={ArrowRight02Icon} />
            </Button>
          )}
        </div>
      )}
      {body()}
    </section>
  )
}
