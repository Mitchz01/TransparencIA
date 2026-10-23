import type { ProjectStatus } from '../../../domain/project'
import type { Hue, IconGlyph } from '@agile/ui'
import { Alert02Icon, Edit02Icon, Loading03Icon, Tick02Icon } from '@agile/ui/icons'

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; hue: Hue; icon: IconGlyph }> = {
  draft: { label: 'Sin planear', hue: 'neutral', icon: Edit02Icon },
  planning: { label: 'En planeación', hue: 'blue', icon: Loading03Icon },
  ready: { label: 'En ejecución', hue: 'teal', icon: Tick02Icon },
  error: { label: 'Requiere atención', hue: 'coral', icon: Alert02Icon },
}
