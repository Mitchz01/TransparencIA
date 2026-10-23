// The first screen of the portal (spec 017, SC-002): who does what for whom, the verdict, and why.
import type { Light, Portal } from '@agile/domain'
import { Button, cn, Icon } from '@agile/ui'
import { Alert02Icon, ArrowLeft01Icon, Calendar03Icon, Link01Icon, Tick02Icon } from '@agile/ui/icons'
import { Comparison, copShort, day } from '@agile/ui/transparency'
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
    <header className="grid gap-5">
      <div className="grid gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 justify-self-start text-label text-ink-muted hover:text-ink">
          <Icon icon={ArrowLeft01Icon} size={16} />
          Todos los proyectos
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-title">{project.name}</h1>
          <ShareButton title={project.name} />
        </div>
        <p className="text-body text-ink-muted">
          {project.contractor} lo ejecuta para {project.contracting_entity}, con un contrato de {copShort(project.contract_value)}.
        </p>
        <p className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
          <Icon icon={Calendar03Icon} size={16} />
          Del {day(project.start_date)} al {day(project.end_date)}
        </p>
      </div>

      <section aria-label="Estado del proyecto" className="grid gap-5 rounded-lg bg-surface p-5">
        <div className={cn('grid gap-2 rounded-md p-4', light.fill)}>
          <p className={cn('flex items-center gap-2 text-heading', light.text)}>
            <Icon icon={light.icon} size={24} />
            {light.word}
          </p>
          <ul className="grid gap-1 text-body">
            {summary.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <Comparison summary={summary} contractValue={project.contract_value} />
      </section>
    </header>
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
    <Button variant="secondary" size="sm" icon={Link01Icon} onClick={share} className="shrink-0">
      {copied ? 'Enlace copiado' : 'Compartir'}
    </Button>
  )
}
