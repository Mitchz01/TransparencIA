import type { IconGlyph } from '@agile/ui'
import { AiMagicIcon, Calendar03Icon, Coins01Icon, DashboardSquare01Icon, File01Icon, Plug01Icon, UserGroupIcon } from '@agile/ui/icons'

export interface Section {
  path: string
  label: string
  icon: IconGlyph
}

/** The project sections, in rail order (spec 009, screen map). Settings sits at the bottom of the rail. */
export const SECTIONS: Section[] = [
  { path: 'planning', label: 'Planificación', icon: AiMagicIcon },
  { path: 'board', label: 'Tablero', icon: DashboardSquare01Icon },
  { path: 'transparency', label: 'Transparencia', icon: Coins01Icon }, // spec 017
  { path: 'plan', label: 'Plan', icon: Calendar03Icon },
  { path: 'documents', label: 'Documentos', icon: File01Icon },
  { path: 'team', label: 'Equipo', icon: UserGroupIcon },
  { path: 'integrations', label: 'Integraciones', icon: Plug01Icon },
]
