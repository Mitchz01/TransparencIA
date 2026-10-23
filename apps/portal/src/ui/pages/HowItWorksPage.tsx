// How the portal works and why its numbers can be trusted (spec 017, credibility rules).
import { ButtonLink, Card, Icon } from '@agile/ui'
import { AiMagicIcon, File01Icon, Search01Icon, Settings01Icon, UserGroupIcon, ViewIcon } from '@agile/ui/icons'

const STEPS = [
  {
    icon: File01Icon,
    title: 'El ejecutor reporta con evidencia',
    body: 'Quien ejecuta el contrato sube cada factura y cada foto de campo, ligada al rubro del presupuesto y a la actividad que pagó.',
  },
  {
    icon: AiMagicIcon,
    title: 'La IA lee y señala, una persona confirma',
    body: 'La IA lee el documento y propone el monto, la fecha y el rubro, y marca lo que no cuadra. Nada se publica hasta que alguien del equipo lo confirma.',
  },
  {
    icon: Settings01Icon,
    title: 'Reglas fijas calculan los números',
    body: 'El dinero usado, el trabajo hecho, el tiempo corrido y el semáforo salen de reglas fijas sobre los gastos confirmados y el tablero de trabajo. La IA no calcula ningún número.',
  },
  {
    icon: ViewIcon,
    title: 'Cualquiera lo revisa',
    body: 'Ciudadanos, veedurías y la entidad que contrata ven el proyecto desde un enlace o un código QR, sin cuenta, y pueden hacerle preguntas.',
  },
]

const LIGHTS = [
  { word: 'En rojo', text: 'text-coral', body: 'Hay una alerta de prioridad alta, el gasto supera el contrato, o se ha gastado más de 25 puntos por encima del avance.' },
  { word: 'En amarillo', text: 'text-amber', body: 'Hay una alerta de prioridad media, el gasto va más de 10 puntos por encima del avance, o el tiempo va más de 20 puntos por delante.' },
  { word: 'En verde', text: 'text-teal', body: 'El gasto y el avance van de la mano, y no hay alertas que lo cambien.' },
]

export function HowItWorksPage() {
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-12 px-4 py-10 md:px-8 md:py-16">
      <header className="grid gap-3">
        <h1 className="text-display">Cómo funciona</h1>
        <p className="max-w-xl text-body text-ink-muted">
          El contrato dice cuánto se firmó. Este portal muestra qué se hizo con esa plata, semana a semana, con la evidencia de cada gasto.
        </p>
      </header>

      <section aria-labelledby="steps" className="grid gap-4">
        <h2 id="steps" className="text-title">Del gasto al portal</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="grid h-full content-start gap-3">
                <span className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-surface-strong">
                    <Icon icon={step.icon} />
                  </span>
                  <span className="text-caption text-ink-muted">Paso {i + 1}</span>
                </span>
                <h3 className="text-heading">{step.title}</h3>
                <p className="text-body text-ink-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="light" className="grid gap-4">
        <h2 id="light" className="text-title">Cómo leer el semáforo</h2>
        <Card className="grid gap-5">
          {LIGHTS.map((light) => (
            <div key={light.word} className="grid gap-1">
              <span className={`text-heading ${light.text}`}>{light.word}</span>
              <p className="text-body text-ink-muted">{light.body}</p>
            </div>
          ))}
          <p className="text-caption text-ink-muted">
            Una alerta respondida sigue contando: el ejecutor puede explicarla en público, pero no borrarla ni ocultarla.
          </p>
        </Card>
      </section>

      <section aria-labelledby="who" className="grid gap-4">
        <h2 id="who" className="text-title">Para quién es</h2>
        <Card className="grid gap-3">
          <p className="flex items-start gap-3 text-body">
            <Icon icon={UserGroupIcon} className="mt-0.5 shrink-0 text-ink-muted" />
            Para los ciudadanos que pagan el proyecto con sus impuestos, las veedurías ciudadanas (Ley 850 de 2003) y la entidad que contrata. La información es pública por la Ley 1712 de 2014.
          </p>
        </Card>
      </section>

      <ButtonLink to="/" variant="primary" size="lg" icon={Search01Icon} className="justify-self-start">
        Buscar un proyecto
      </ButtonLink>
    </div>
  )
}
