// The first screen of the portal (spec 017, SC-002): who does what for whom, then one card with the verdict, why,
// and the three numbers it comes from (money, work, time) on one 0 to 100 scale. Values come from the backend.
import type { Light, Portal } from '@agile/domain'
import { Button, cn, Icon } from '@agile/ui'
import { Alert02Icon, ArrowLeft01Icon, Calendar03Icon, Link01Icon, Tick02Icon } from '@agile/ui/icons'
import { copShort, day, pct } from '@agile/ui/transparency'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const LIGHTS: Record<Light, { word: string; text: string; fill: string; icon: typeof Tick02Icon }> = {
  green: { word: 'En verde', text: 'text-teal', fill: 'bg-teal-soft', icon: Tick02Icon },
  yellow: { word: 'En amarillo', text: 'text-amber', fill: 'bg-amber-soft', icon: Alert02Icon },
  red: { word: 'En rojo', text: 'text-coral', fill: 'bg-coral-soft', icon: Alert02Icon },
}

export function PortalHero({ portal }: { portal: Portal }) {
  const { project, summary } = portal
  const light = LIGHTS[summary.light]
  return (
    <header className="grid gap-6">
      <div className="grid gap-4">
        <Link to="/" className="inline-flex items-center gap-1.5 justify-self-start text-label text-ink-muted hover:text-ink">
          <Icon icon={ArrowLeft01Icon} size={16} />
          Todos los proyectos
        </Link>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="grid max-w-3xl gap-3">
            <h1 className="text-title text-balance md:text-display">{project.name}</h1>
            <p className="text-body text-ink-muted">
              <span className="text-ink">{project.contractor}</span> lo ejecuta para <span className="text-ink">{project.contracting_entity}</span>, con un
              contrato de <span className="text-ink tabular-nums">{copShort(project.contract_value)}</span>.
            </p>
            <p className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
              <Icon icon={Calendar03Icon} size={16} />
              Del {day(project.start_date)} al {day(project.end_date)}
            </p>
          </div>
          <ShareButton title={project.name} />
        </div>
      </div>

      {/* One card: the verdict and the three numbers it comes from, nothing repeated (design system rule 8). */}
      <section aria-label="Estado del proyecto" className="grid gap-5 rounded-lg bg-surface p-4 sm:p-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:items-center lg:gap-8">
        <div className={cn('grid content-start gap-2 rounded-md p-4 sm:p-5', light.fill)}>
          <p className={cn('flex items-center gap-2 text-title', light.text)}>
            <Icon icon={light.icon} size={24} />
            {light.word}
          </p>
          <ul className="grid gap-1 text-body">
            {summary.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          <Metric
            name="Dinero usado"
            value={summary.spent_pct}
            fill={summary.spent_pct > 100 ? 'bg-coral' : 'bg-chart-money'}
            over={summary.spent_pct > 100}
            note={`${copShort(summary.spent)} de ${copShort(project.contract_value)}`}
          />
          <Metric name="Trabajo hecho" value={summary.physical_pct} fill="bg-chart-work" />
          <Metric name="Tiempo corrido" value={summary.time_pct} fill="bg-ink-subtle" />
        </div>
      </section>
    </header>
  )
}

interface MetricProps {
  name: string
  value: number | null
  fill: string
  note?: string
  over?: boolean
}

/** A value, its name next to it (design system rule 3) and its bar on the shared 0 to 100 scale. */
function Metric({ name, value, fill, note, over }: MetricProps) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div className="grid content-start gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label">{name}</span>
        <span className={cn('text-title tabular-nums', over && 'text-coral')}>{value === null ? 'Sin dato' : pct(value)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${name}: ${value === null ? 'sin dato' : pct(value)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        className="h-[10px] overflow-hidden rounded-pill bg-surface-strong"
      >
        <div className={cn('h-full rounded-pill', fill)} style={{ width: `${width}%` }} />
      </div>
      {note && <span className={cn('text-caption tabular-nums', over ? 'text-coral' : 'text-ink-muted')}>{note}</span>}
    </div>
  )
}

/** The phone's share sheet when there is one; otherwise the link goes to the clipboard. */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Dismissing the share sheet rejects; nothing to tell.
    }
  }
  return (
    <Button variant="secondary" icon={Link01Icon} onClick={share} className="justify-self-start md:justify-self-end">
      {copied ? 'Enlace copiado' : 'Compartir'}
    </Button>
  )
}
