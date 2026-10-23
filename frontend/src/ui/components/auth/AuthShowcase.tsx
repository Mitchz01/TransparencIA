import { useState } from 'react'
import { AgentSpark, Avatar, Icon, IconButton, NotchedPanel } from '../ds'
import { ArrowLeft02Icon, ArrowRight02Icon, QuoteDownIcon } from '../ds/icons'
import { STAGE_LABELS } from '../planning/stageLabels'
import { ThemeToggle } from '../shell/TopBar'

// What each agent says it does, in its own voice: the sign in screens show the product, not a form alone.
const VOICES = [
  { stage: 'analysis', quote: 'Leo tu descripción y separo lo esencial de lo deseable, con las dudas que conviene resolver antes de empezar.' },
  { stage: 'methodology', quote: 'Elijo la metodología según tu equipo y la duración, y te explico por qué. Si prefieres otra, la cambias.' },
  { stage: 'architecture', quote: 'Propongo la arquitectura y los diagramas. Nada queda decidido hasta que lo apruebes.' },
  { stage: 'backlog', quote: 'Armo el backlog con criterios de aceptación y reparto el trabajo según las horas de cada persona.' },
] as const

// The demo people, with their Pexels portraits from public/avatars/.
const TEAM = [
  { name: 'Ana Gómez', photo: '/avatars/ana-gomez.jpg' },
  { name: 'Leo Ruiz', photo: '/avatars/leo-ruiz.jpg' },
  { name: 'Marta Díaz', photo: '/avatars/marta-diaz.jpg' },
]

/** The right half of the sign in screens: what the agents do, and how the team joins. */
export function AuthShowcase() {
  const [index, setIndex] = useState(0)
  const voice = VOICES[index]
  const label = STAGE_LABELS[voice.stage]
  const step = (delta: number) => setIndex((i) => (i + delta + VOICES.length) % VOICES.length)

  return (
    <NotchedPanel
      as="aside"
      aria-label="Cómo funciona"
      tone="primary-soft"
      notch={{ width: 104, height: 84 }}
      radius={32}
      corner={<ThemeToggle />}
      className="relative flex h-full min-h-[640px] flex-col overflow-hidden p-10 text-primary-soft-ink xl:p-14"
    >
      <AgentSpark variant="line" size={340} className="pointer-events-none absolute top-40 -right-16 opacity-25" />

      <h2 className="relative max-w-[19ch] pr-24 text-display text-ink">Describe la idea. Los agentes la planifican.</h2>

      <figure className="relative mt-10 grid max-w-lg gap-6">
        <Icon icon={QuoteDownIcon} size={24} />
        <blockquote aria-live="polite" className="min-h-[5.5rem] text-heading font-normal text-ink">
          {voice.quote}
        </blockquote>
        <figcaption className="grid gap-0.5">
          <span className="text-heading">{label.agent}</span>
          <span className="text-label font-normal">Agente de {label.name.toLowerCase()}</span>
        </figcaption>
      </figure>

      <div className="relative mt-8 flex items-center gap-3">
        <IconButton icon={ArrowLeft02Icon} label="Agente anterior" variant="surface" tooltip="none" onClick={() => step(-1)} />
        <IconButton icon={ArrowRight02Icon} label="Agente siguiente" variant="inverse" tooltip="none" onClick={() => step(1)} />
        <span className="text-label font-normal tabular-nums">{index + 1} de {VOICES.length}</span>
      </div>

      <NotchedPanel
        tone="surface"
        notch={{ width: 96, height: 92 }}
        radius={28}
        corner={
          <span className="inline-flex size-[72px] items-center justify-center rounded-pill bg-surface text-ink">
            <AgentSpark size={34} />
          </span>
        }
        className="relative mt-auto grid gap-3 p-7 text-ink"
      >
        {/* Text keeps clear of the cut on the right; the team row sits under it, on the left. */}
        <h3 className="pr-24 text-heading">Tu equipo entra con un link</h3>
        <p className="max-w-sm pr-16 text-body text-ink-muted">Cada persona llega con su perfil y los agentes reparten el trabajo según quién está.</p>
        <div className="mt-2 flex items-center gap-3">
          <span role="img" className="flex -space-x-1" aria-label="Ana Gómez, Leo Ruiz, Marta Díaz y 2 más">
            {TEAM.map(({ name, photo }) => <Avatar key={name} name={name} src={photo} className="ring-2 ring-surface" />)}
            <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-pill bg-inverse text-caption font-semibold text-on-inverse ring-2 ring-surface tabular-nums">
              +2
            </span>
          </span>
          <span className="text-caption text-ink-muted">ya están en Tienda online</span>
        </div>
      </NotchedPanel>
    </NotchedPanel>
  )
}
