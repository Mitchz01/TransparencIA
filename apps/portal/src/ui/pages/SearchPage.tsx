// The portal's home (spec 017, US8): find a published project and open its portal. No account.
// Same frame as the team app's home (spec 016): the living gradient in a rounded panel, the projects over it.
import { SEARCH_QUERY_MAX, type Light, type PublicProjectCard } from '@agile/domain'
import { Chip, Icon } from '@agile/ui'
import { Search01Icon, ViewIcon } from '@agile/ui/icons'
import { copShort } from '@agile/ui/transparency'
import { useDeferredValue, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProjectSearch } from '../../application/useProjectSearch'
import { HomeSections } from '../components/home/HomeSections'
import { LIGHT_ORDER, LIGHTS } from '../components/home/lights'
import { LivePreview } from '../components/home/LivePreview'
import { MeshHero } from '../components/home/MeshHero'
import { ProjectResults } from '../components/home/ProjectResults'

const SUGGESTIONS = ['manglar', 'Corpamag', 'vía', 'acueducto']

/** Its place in the hero's entrance sequence. */
const step = (i: number) => ({ '--i': i }) as CSSProperties

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const light = LIGHT_ORDER.find((l) => l === params.get('estado')) ?? null
  const search = useProjectSearch(useDeferredValue(query))
  const everything = useProjectSearch('')

  const update = (next: { q?: string; estado?: Light | null }) => {
    const merged = new URLSearchParams(params)
    if (next.q) merged.set('q', next.q)
    else if (next.q !== undefined) merged.delete('q')
    if (next.estado) merged.set('estado', next.estado)
    else if (next.estado !== undefined) merged.delete('estado')
    setParams(merged, { replace: true })
  }

  const suggest = (word: string) => {
    update({ q: word })
    document.getElementById('buscar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const all = search.data ?? []
  const shown = light ? all.filter((card) => card.light === light) : all
  const published = everything.data ?? []
  const featured = featuredProject(published)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)]">
      <div className="px-3">
        <div className="relative isolate overflow-hidden rounded-xl">
          <MeshHero />
          <section
            aria-labelledby="home-title"
            className="relative z-10 flex min-h-[min(78svh,760px)] flex-col items-center gap-6 px-4 pt-14 pb-[168px] text-center sm:px-8 sm:pt-20"
          >
            <span className="rise inline-flex items-center gap-2 rounded-pill bg-on-mesh/15 px-4 py-1.5 text-label text-on-mesh backdrop-blur" style={step(0)}>
              <Icon icon={ViewIcon} size={16} />
              Datos públicos, sin cuenta
            </span>
            <h1 id="home-title" className="rise max-w-3xl text-display text-balance text-on-mesh md:text-[3.25rem] md:leading-[1.08]" style={step(1)}>
              Sigue la plata de los proyectos públicos
            </h1>
            <p className="rise max-w-xl text-body text-on-mesh/85 md:text-[1.0625rem]" style={step(2)}>
              Mira en qué se usó el dinero de cada contrato, cuánto trabajo se ha hecho y qué alertas tiene, con la evidencia de cada gasto.
            </p>
            <form role="search" onSubmit={(event) => event.preventDefault()} className="rise w-full max-w-xl" style={step(3)}>
              <label className="flex h-control-lg items-center gap-3 rounded-pill bg-surface px-5 shadow-float">
                <Icon icon={Search01Icon} className="shrink-0 text-ink-muted" />
                <span className="sr-only">Buscar proyectos</span>
                <input
                  type="search"
                  enterKeyHint="search"
                  placeholder="Proyecto, entidad o lugar"
                  maxLength={SEARCH_QUERY_MAX}
                  value={query}
                  onChange={(event) => update({ q: event.target.value })}
                  className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
                />
              </label>
            </form>
            <div className="rise flex flex-wrap justify-center gap-2" style={step(4)}>
              {SUGGESTIONS.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => suggest(word)}
                  className="inline-flex h-control-sm items-center rounded-pill bg-on-mesh/15 px-3 text-label text-on-mesh backdrop-blur transition-[background-color] duration-150 hover:bg-on-mesh/25"
                >
                  {word}
                </button>
              ))}
            </div>
            {featured && <LivePreview card={featured} />}
          </section>
        </div>
      </div>

      <section id="buscar" aria-labelledby="projects-title" className="relative z-10 -mt-[120px] scroll-mt-20 px-3 sm:px-6">
        <div className="mx-auto grid max-w-[1200px] gap-5 rounded-xl bg-bg p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h2 id="projects-title" className="text-title">
                Proyectos publicados
              </h2>
              {published.length > 0 && <Totals cards={published} />}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
              <Chip pressed={light === null} onClick={() => update({ estado: null })}>
                Todos ({all.length})
              </Chip>
              {LIGHT_ORDER.map((l) => (
                <Chip key={l} pressed={light === l} onClick={() => update({ estado: light === l ? null : l })}>
                  {LIGHTS[l].word} ({all.filter((card) => card.light === l).length})
                </Chip>
              ))}
            </div>
          </div>
          <ProjectResults
            loading={search.isPending}
            failed={search.isError}
            cards={shown}
            filtered={query.trim() !== '' || light !== null}
            onClear={() => update({ q: '', estado: null })}
            onRetry={() => void search.refetch()}
          />
        </div>
      </section>

      <HomeSections />
    </div>
  )
}

/** The hero shows the project with the most to look at: open alerts first, then the most money used. */
function featuredProject(cards: PublicProjectCard[]): PublicProjectCard | undefined {
  return [...cards].sort((a, b) => b.open_alerts - a.open_alerts || b.spent_pct - a.spent_pct)[0]
}

/** What's published, in one sentence: how many projects, how much money and how many open alerts. */
function Totals({ cards }: { cards: PublicProjectCard[] }) {
  const value = cards.reduce((sum, card) => sum + card.contract_value, 0)
  const alerts = cards.reduce((sum, card) => sum + card.open_alerts, 0)
  return (
    <p className="text-body text-ink-muted">
      {cards.length === 1 ? '1 proyecto' : `${cards.length} proyectos`} por {copShort(value)} en contratos
      {alerts > 0 ? `, con ${alerts === 1 ? '1 alerta' : `${alerts} alertas`} en revisión.` : '.'}
    </p>
  )
}
