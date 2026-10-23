import type { IconGlyph } from '@agile/ui'
import { AiMagicIcon, Calendar03Icon, Coins01Icon, DashboardSquare01Icon, UserGroupIcon } from '@agile/ui/icons'

export interface Section {
  path: string
  label: string
  icon: IconGlyph
}

/** The project sections, in rail order (spec 009, screen map). Settings sits at the bottom of the rail.
 *  Spec 017 (D13): Documentos and Integraciones leave the navigation; their routes stay. */
export const SECTIONS: Section[] = [
  { path: 'planning', label: 'Planificación', icon: AiMagicIcon },
  { path: 'board', label: 'Tablero', icon: DashboardSquare01Icon },
  { path: 'transparency', label: 'Transparencia', icon: Coins01Icon }, // spec 017
  { path: 'plan', label: 'Plan', icon: Calendar03Icon },
  { path: 'team', label: 'Equipo', icon: UserGroupIcon },
]
