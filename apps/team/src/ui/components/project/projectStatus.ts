import type { ProjectStatus } from '../../../domain/project'
import type { Hue, IconGlyph } from '@agile/ui'
import { Alert02Icon, Edit02Icon, Loading03Icon, Tick02Icon } from '@agile/ui/icons'

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; hue: Hue; icon: IconGlyph }> = {
  draft: { label: 'Borrador', hue: 'neutral', icon: Edit02Icon },
  planning: { label: 'Planificando', hue: 'blue', icon: Loading03Icon },
  ready: { label: 'Listo', hue: 'teal', icon: Tick02Icon },
  error: { label: 'Te necesita', hue: 'coral', icon: Alert02Icon },
}
