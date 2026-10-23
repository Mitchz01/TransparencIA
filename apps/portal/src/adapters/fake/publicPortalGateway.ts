// Spec 017's public portal without a backend: the demo portal for any slug, 404 for "no-existe". Owner: P5.

import type { Portal, PublicProjectCard } from '@agile/domain'
import { demoTeamPortal } from '@agile/domain/fixtures'
import { ApiError } from '../../application/errors'
import type { PublicPortalGateway } from '../../application/ports'
import { samplePortal } from './samplePortal'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const notFound = () => new ApiError(404, { code: 'project_not_found', detail: 'Project not found.' })

/** P4's fixture minus the team-only fields; the sample portal until the fixture is written. */
function demoPortal(): Portal {
  try {
    const { drafts: _drafts, public: _public, ...portal } = demoTeamPortal()
    return portal
  } catch {
    return samplePortal()
  }
}

/** The demo project plus two more, so the home has something to search. */
function demoCards(): PublicProjectCard[] {
  const { project, summary, alerts } = demoPortal()
  const demo: PublicProjectCard = {
    slug: 'demo', ...project, light: summary.light, spent_pct: summary.spent_pct, physical_pct: summary.physical_pct,
    time_pct: summary.time_pct, open_alerts: alerts.filter((alert) => !alert.answer).length,
  }
  return [
    demo,
    {
      slug: 'via-aracataca', name: 'Mejoramiento de la vía terciaria Aracataca a Sevilla',
      description: 'Placa huella de 4 km, cunetas y obras de drenaje para la vía veredal.',
      contracting_entity: 'Gobernación del Magdalena', contractor: 'Consorcio Vías del Banano', contract_value: 2_350_000_000,
      start_date: '2026-03-02', end_date: '2026-12-14', light: 'red', spent_pct: 71.5, physical_pct: 38, time_pct: 79.4, open_alerts: 2,
    },
    {
      slug: 'acueducto-guachaca', name: 'Acueducto comunitario de Guachaca',
      description: 'Captación, tanque de 120 m³ y redes para 340 familias del corregimiento.',
      contracting_entity: 'Alcaldía de Santa Marta', contractor: 'Asociación Agua Viva', contract_value: 640_000_000,
      start_date: '2026-05-04', end_date: '2026-11-30', light: 'green', spent_pct: 52, physical_pct: 58.5, time_pct: 82, open_alerts: 0,
    },
  ]
}

const fold = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()

const cop = (amount: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)

export function fakePublicPortalGateway(): PublicPortalGateway {
  return {
    async searchProjects(query) {
      await wait(250)
      const words = fold(query).split(/\s+/).filter(Boolean)
      return demoCards().filter((card) => {
        const text = fold([card.name, card.description, card.contracting_entity, card.contractor].join(' '))
        return words.every((word) => text.includes(word))
      })
    },
    async getPortal(slug) {
      await wait(300)
      if (slug === 'no-existe') throw notFound()
      return demoPortal()
    },
    async ask(slug) {
      await wait(1000)
      if (slug === 'no-existe') throw notFound()
      const { summary, lines } = demoPortal()
      const used = lines.filter((line) => line.spent > 0).map((line) => `${line.name} (${cop(line.spent)})`)
      return {
        answer: `Se han gastado ${cop(summary.spent)}${used.length ? `, en ${used.join(' y ')}` : ''}. Lo demás aún no se ha reportado.`,
      }
    },
  }
}
