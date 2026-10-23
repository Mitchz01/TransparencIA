// What the portal is for, below the projects: what you can see, how it works, who it's for, and questions.
import { buttonClasses, ButtonLink, Card, Icon } from '@agile/ui'
import {
  Alert02Icon, ArrowRight01Icon, Coins01Icon, File01Icon, Login01Icon, Search01Icon, Target02Icon, UserGroupIcon,
} from '@agile/ui/icons'
import type { ReactNode } from 'react'
import { TEAM_APP_URL } from '../../../application/links'
import { STEPS } from './content'

function Block({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6">
      <div className="grid max-w-2xl gap-2">
        <h2 id={id} className="text-title">
          {title}
        </h2>
        {intro && <p className="text-body text-ink-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

const SEES = [
  {
    icon: Coins01Icon,
    title: 'El dinero contra el trabajo',
    body: 'Cuánto se ha usado del contrato, cuánto trabajo se ha terminado y cuánto plazo ha corrido, en la misma escala. Si el gasto se adelanta al avance, se nota.',
  },
  {
    icon: File01Icon,
    title: 'La evidencia de cada gasto',
    body: 'Cada factura y cada foto de campo, con su fecha, su monto, el rubro que usó y la actividad que pagó, explicada en una frase.',
  },
  {
    icon: Alert02Icon,
    title: 'Alertas que no se pueden borrar',
    body: 'Lo que no cuadra queda marcado para revisión. El ejecutor puede responder en público, pero la alerta sigue ahí.',
  },
]

const AUDIENCES = [
  { title: 'Ciudadanos', body: 'Ven en qué se usan sus impuestos, cerca de donde viven, desde el celular.' },
  { title: 'Veedurías', body: 'Siguen el contrato semana a semana, con la evidencia a la mano (Ley 850 de 2003).' },
  { title: 'Entidades que contratan', body: 'Revisan el avance del contratista sin pedir informes ni esperar el corte.' },
  { title: 'Ejecutores', body: 'Muestran su trabajo con evidencia y responden las dudas en público.' },
]

const FAQ = [
  { q: '¿Necesito una cuenta?', a: 'No. Todo lo que ves aquí es público, por la Ley 1712 de 2014.' },
  { q: '¿De dónde salen los datos?', a: 'Los reporta quien ejecuta el contrato, con una factura o una foto por cada gasto o actividad. Una persona de su equipo confirma cada uno antes de publicarlo.' },
  { q: '¿La IA decide si algo está mal?', a: 'No. La IA lee los documentos y señala lo que no cuadra para que una persona lo revise. Los números y el semáforo los calculan reglas fijas.' },
  { q: '¿Qué hago si veo una alerta?', a: 'Lee la respuesta del ejecutor, si la hay, y mira la evidencia del gasto. Si te quedan dudas, la veeduría o la entidad que contrata pueden pedir explicaciones.' },
  { q: '¿Cómo publico mi proyecto?', a: 'Si ejecutas un contrato, entra como ejecutor, carga el presupuesto y tus gastos con su evidencia, y publica el portal. Te damos el enlace y un código QR.' },
]

export function HomeSections() {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-20 px-4 pt-20 md:px-8">
      <Block id="que-ves" title="Qué puedes ver de cada proyecto" intro="Un proyecto público en una sola página, para leerla en el celular en un minuto.">
        <ul className="grid gap-3 md:grid-cols-3">
          {SEES.map((item) => (
            <li key={item.title}>
              <Card className="grid h-full content-start gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary-soft-ink">
                  <Icon icon={item.icon} />
                </span>
                <h3 className="text-heading">{item.title}</h3>
                <p className="text-body text-ink-muted">{item.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Block>

      <section aria-label="La idea" className="rounded-xl bg-inverse px-6 py-12 text-on-inverse md:px-12 md:py-16">
        <p className="max-w-3xl text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] text-balance md:text-[2.5rem]">
          El contrato dice cuánto se firmó. Aquí ves qué se hizo con esa plata.
        </p>
      </section>

      <Block id="como" title="Cómo funciona" intro="Del gasto al portal en cuatro pasos. Ningún número lo pone la IA.">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="grid h-full content-start gap-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-surface-strong">
                    <Icon icon={step.icon} />
                  </span>
                  <span className="text-caption text-ink-muted">Paso {i + 1}</span>
                </span>
                <h3 className="text-label">{step.title}</h3>
                <p className="text-caption text-ink-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
        <ButtonLink to="/como-funciona" variant="secondary" icon={ArrowRight01Icon} className="justify-self-start">
          Ver cómo se calcula el semáforo
        </ButtonLink>
      </Block>

      <Block id="para-quien" title="Para quién es">
        <ul className="grid gap-3 sm:grid-cols-2">
          {AUDIENCES.map((audience) => (
            <li key={audience.title}>
              <Card className="flex h-full items-start gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-strong">
                  <Icon icon={audience.title === 'Ejecutores' ? Target02Icon : UserGroupIcon} />
                </span>
                <span className="grid gap-1">
                  <h3 className="text-heading">{audience.title}</h3>
                  <p className="text-body text-ink-muted">{audience.body}</p>
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="preguntas" title="Preguntas frecuentes">
        <ul className="grid gap-2">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="group rounded-lg bg-surface px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-label [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Icon icon={ArrowRight01Icon} size={16} className="shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-90" />
                </summary>
                <p className="mt-3 max-w-2xl text-body text-ink-muted">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </Block>

      <section aria-labelledby="cierre" className="grid justify-items-start gap-5 rounded-xl bg-primary-soft p-8 text-primary-soft-ink md:p-12">
        <h2 id="cierre" className="max-w-xl text-title">
          ¿Ejecutas un contrato público? Muestra tu trabajo con evidencia.
        </h2>
        <p className="max-w-xl text-body">
          Planea el proyecto, registra cada gasto con su factura o su foto y publica el portal con un código QR para la comunidad.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`${TEAM_APP_URL}/login`} className={buttonClasses('primary', 'lg')}>
            <Icon icon={Login01Icon} />
            Entrar como ejecutor
          </a>
          <a href="#buscar" className={buttonClasses('secondary', 'lg')}>
            <Icon icon={Search01Icon} />
            Buscar un proyecto
          </a>
        </div>
      </section>
    </div>
  )
}
