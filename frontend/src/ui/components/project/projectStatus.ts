import type { ProjectStatus } from '../../../domain/project'
import type { Hue, IconGlyph } from '../ds'
import { Alert02Icon, Edit02Icon, Loading03Icon, Tick02Icon } from '../ds/icons'

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; hue: Hue; icon: IconGlyph }> = {
  draft: { label: 'Draft', hue: 'neutral', icon: Edit02Icon },
  planning: { label: 'Planning', hue: 'blue', icon: Loading03Icon },
  ready: { label: 'Ready', hue: 'teal', icon: Tick02Icon },
  error: { label: 'Needs you', hue: 'coral', icon: Alert02Icon },
}
