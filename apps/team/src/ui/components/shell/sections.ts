import type { IconGlyph } from '@agile/ui'
import { AiMagicIcon, Calendar03Icon, CheckListIcon, Invoice01Icon, UserGroupIcon } from '@agile/ui/icons'

export interface Section {
  path: string
  label: string
  icon: IconGlyph
}

/** The project sections, in menu order. Settings sits at the bottom of the menu.
 *  Spec 017 (D13): Documentos and Integraciones leave the navigation; their routes stay.
 *  Spec 019: the names of public projects, not of software development. */
export const SECTIONS: Section[] = [
  { path: 'planning', label: 'Planeación con IA', icon: AiMagicIcon },
  { path: 'plan', label: 'Plan de trabajo', icon: Calendar03Icon },
  { path: 'board', label: 'Actividades', icon: CheckListIcon },
  { path: 'transparency', label: 'Evidencias y gastos', icon: Invoice01Icon }, // spec 017
  { path: 'team', label: 'Equipo', icon: UserGroupIcon },
]
