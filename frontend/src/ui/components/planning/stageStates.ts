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
  approved: { label: 'Approved', hue: 'teal', icon: Tick02Icon },
  waiting: { label: 'Waiting for you', hue: 'amber', icon: HourglassIcon },
  needs_leader: { label: 'Needs you', hue: 'amber', icon: UserWarning01Icon },
  failed: { label: 'Failed', hue: 'coral', icon: Alert02Icon },
  working: { label: 'Working', hue: 'blue', icon: Loading03Icon, spin: true },
  not_started: { label: 'Not started', hue: 'neutral' },
}

/** How a proposal ended (or that it's still open), for its pill. */
export function proposalLook(proposal: Proposal, applying: boolean): StateLook {
  if (proposal.apply_failed) return { label: 'Couldn’t apply', hue: 'coral', icon: Alert02Icon }
  if (applying) return { label: 'Applying', hue: 'blue', icon: Loading03Icon }
  switch (proposal.status) {
    case 'pending':
      return { label: 'Waiting for you', hue: 'amber', icon: HourglassIcon }
    case 'approved':
      return { label: proposal.auto_approved ? 'Approved automatically' : 'Approved', hue: 'lime', icon: Tick02Icon }
    case 'adjusted':
      return { label: 'Adjusted by you', hue: 'lime', icon: Edit02Icon }
    case 'rejected':
      return { label: 'Rejected', hue: 'coral', icon: Cancel01Icon }
    case 'discarded':
      return { label: 'Discarded', hue: 'neutral', icon: Cancel01Icon }
  }
}
