// Spec 017's public portal without a backend: the demo portal for any slug, 404 for "no-existe". Owner: P5.

import type { Portal } from '@agile/domain'
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

const cop = (amount: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)

export function fakePublicPortalGateway(): PublicPortalGateway {
  return {
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
