// The portal's home (spec 017, US8): find a published project and open its portal. No account.
import { SEARCH_QUERY_MAX, type Light, type PublicProjectCard } from '@agile/domain'
import { Chip, cn, EmptyState, Icon, Pill, SkeletonCard, TextField, Button, type Hue } from '@agile/ui'
import { Alert02Icon, Calendar03Icon, Search01Icon, Tick02Icon } from '@agile/ui/icons'
import { copShort, day, pct } from '@agile/ui/transparency'
import { useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProjectSearch } from '../../application/useProjectSearch'

const LIGHTS: Record<Light, { word: string; hue: Hue; icon: typeof Tick02Icon }> = {
  red: { word: 'En rojo', hue: 'coral', icon: Alert02Icon },
  yellow: { word: 'En amarillo', hue: 'amber', icon: Alert02Icon },
  green: { word: 'En verde', hue: 'teal', icon: Tick02Icon },
}
const ORDER: Light[] = ['red', 'yellow', 'green']

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const light = ORDER.find((l) => l === params.get('estado')) ?? null
  const search = useProjectSearch(useDeferredValue(query))

  const update = (next: { q?: string; estado?: Light | null }) => {
    const merged = new URLSearchParams(params)
    if (next.q) merged.set('q', next.q)
    else if (next.q !== undefined) merged.delete('q')
    if (next.estado) merged.set('estado', next.estado)
    else if (next.estado !== undefined) merged.delete('estado')
    setParams(merged, { replace: true })
  }

  const all = search.data ?? []
  const shown = light ? all.filter((card) => card.light === light) : all

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 md:px-8 md:py-14">
      <header className="grid gap-3">
        <h1 className="max-w-2xl text-display">Sigue la plata de los proyectos públicos</h1>
        <p className="max-w-xl text-body text-ink-muted">
          Busca un proyecto y mira en qué se ha usado el dinero, cuánto trabajo se ha hecho y qué alertas tiene. Sin cuenta.
        </p>
        {!query && all.length > 0 && <Totals cards={all} />}
      </header>

      <section aria-label="Buscar proyectos" className="grid gap-4">
        <form role="search" onSubmit={(event) => event.preventDefault()}>
          <TextField
            label="Buscar proyectos"
            hideLabel
            type="search"
            enterKeyHint="search"
            placeholder="Nombre, entidad, contratista o lugar"
            maxLength={SEARCH_QUERY_MAX}
            value={query}
            onChange={(event) => update({ q: event.target.value })}
          />
        </form>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          <Chip pressed={light === null} onClick={() => update({ estado: null })}>
            Todos ({all.length})
          </Chip>
          {ORDER.map((l) => (
            <Chip key={l} pressed={light === l} onClick={() => update({ estado: light === l ? null : l })}>
              {LIGHTS[l].word} ({all.filter((card) => card.light === l).length})
            </Chip>
          ))}
        </div>
      </section>

      <Results
        loading={search.isPending}
        failed={search.isError}
        cards={shown}
        filtered={query.trim() !== '' || light !== null}
        onClear={() => update({ q: '', estado: null })}
        onRetry={() => void search.refetch()}
      />

    </div>
  )
}

/** What's published, in one sentence: how many projects, how much money and how many open alerts. */
function Totals({ cards }: { cards: PublicProjectCard[] }) {
  const value = cards.reduce((sum, card) => sum + card.contract_value, 0)
  const alerts = cards.reduce((sum, card) => sum + card.open_alerts, 0)
  return (
    <p className="text-label">
      {cards.length === 1 ? '1 proyecto publicado' : `${cards.length} proyectos publicados`} por {copShort(value)} en contratos
      {alerts > 0 ? `, con ${alerts === 1 ? '1 alerta' : `${alerts} alertas`} en revisión.` : '.'}
    </p>
  )
}

interface ResultsProps {
  loading: boolean
  failed: boolean
  cards: PublicProjectCard[]
  filtered: boolean
  onClear: () => void
  onRetry: () => void
}

function Results({ loading, failed, cards, filtered, onClear, onRetry }: ResultsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    )
  }
  if (failed) {
    return (
      <EmptyState icon={Alert02Icon} title="No se pudieron cargar los proyectos" action={<Button onClick={onRetry}>Volver a intentar</Button>}>
        Revisa tu conexión.
      </EmptyState>
    )
  }
  if (cards.length === 0) {
    return filtered ? (
      <EmptyState icon={Search01Icon} title="Ningún proyecto público coincide" action={<Button variant="secondary" onClick={onClear}>Ver todos los proyectos</Button>}>
        Prueba con otra palabra, como el municipio o la entidad que contrata.
      </EmptyState>
    ) : (
      <EmptyState icon={Search01Icon} title="Todavía no hay proyectos publicados" />
    )
  }
  return (
    <section aria-label="Resultados" className="grid gap-3">
      <p className="px-1 text-caption text-ink-muted" aria-live="polite">
        {cards.length === 1 ? '1 proyecto público' : `${cards.length} proyectos públicos`}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.slug} className="grid">
            <ProjectCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProjectCard({ card }: { card: PublicProjectCard }) {
  const light = LIGHTS[card.light]
  return (
    <Link
      to={`/p/${encodeURIComponent(card.slug)}`}
      className="grid content-start gap-4 rounded-lg bg-surface p-5 transition-[background-color] duration-150 hover:bg-surface-strong"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill hue={light.hue} icon={light.icon}>
          {light.word}
        </Pill>
        {card.open_alerts > 0 && (
          <span className="text-caption text-ink-muted">{card.open_alerts === 1 ? '1 alerta en revisión' : `${card.open_alerts} alertas en revisión`}</span>
        )}
      </div>
      <div className="grid gap-1">
        <h2 className="text-heading">{card.name}</h2>
        <p className="text-caption text-ink-muted">
          {card.contractor} para {card.contracting_entity}
        </p>
      </div>
      <div className="grid gap-2.5">
        <MiniBar name="Dinero usado" value={card.spent_pct} fill="bg-chart-1" />
        <MiniBar name="Trabajo hecho" value={card.physical_pct} fill="bg-chart-2" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
        <span className="tabular-nums">{copShort(card.contract_value)}</span>
        <span className="inline-flex items-center gap-1.5">
          <Icon icon={Calendar03Icon} size={16} />
          Hasta el {day(card.end_date)}
        </span>
      </div>
    </Link>
  )
}

function MiniBar({ name, value, fill }: { name: string; value: number | null; fill: string }) {
  const over = value !== null && value > 100
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-3 text-caption">
        <span className="text-ink-muted">{name}</span>
        <span className={cn('tabular-nums', over ? 'text-coral' : 'text-ink')}>{value === null ? 'Sin dato' : pct(value)}</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-pill bg-surface-strong" aria-hidden="true">
        <div className={cn('h-full rounded-pill', over ? 'bg-coral' : fill)} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
      </div>
    </div>
  )
}
