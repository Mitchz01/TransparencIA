import type { Proposal } from '../../../domain/proposals'
import type { StageState } from '../../../domain/stepper'
import type { Hue, IconGlyph } from '../ds'
import { Alert02Icon, Cancel01Icon, Edit02Icon, HourglassIcon, Loading03Icon, Tick02Icon, UserWarning01Icon } from '../ds/icons'

interface StateLook {
  label: string
  hue: Hue
  icon?: IconGlyph
  spin?: boolean
}

export const STAGE_STATES: Record<StageState, StateLook> = {
  approved: { label: 'Aprobada', hue: 'teal', icon: Tick02Icon },
  waiting: { label: 'Espera tu decisión', hue: 'amber', icon: HourglassIcon },
  needs_leader: { label: 'Te necesita', hue: 'amber', icon: UserWarning01Icon },
  failed: { label: 'Falló', hue: 'coral', icon: Alert02Icon },
  working: { label: 'Trabajando', hue: 'blue', icon: Loading03Icon, spin: true },
  not_started: { label: 'Sin empezar', hue: 'neutral' },
}

/** How a proposal ended (or that it's still open), for its pill. */
export function proposalLook(proposal: Proposal, applying: boolean): StateLook {
  if (proposal.apply_failed) return { label: 'No se pudo aplicar', hue: 'coral', icon: Alert02Icon }
  if (applying) return { label: 'Aplicando', hue: 'blue', icon: Loading03Icon }
  switch (proposal.status) {
    case 'pending':
      return { label: 'Espera tu decisión', hue: 'amber', icon: HourglassIcon }
    case 'approved':
      return { label: proposal.auto_approved ? 'Aprobada automáticamente' : 'Aprobada', hue: 'lime', icon: Tick02Icon }
    case 'adjusted':
      return { label: 'Ajustada por ti', hue: 'lime', icon: Edit02Icon }
    case 'rejected':
      return { label: 'Rechazada', hue: 'coral', icon: Cancel01Icon }
    case 'discarded':
      return { label: 'Descartada', hue: 'neutral', icon: Cancel01Icon }
  }
}
