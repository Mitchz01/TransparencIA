export interface Section {
  path: string
  label: string
}

/** The project sections, in top bar order (spec 009, screen map). Settings is an icon button. */
export const SECTIONS: Section[] = [
  { path: 'planning', label: 'Planificación' },
  { path: 'board', label: 'Tablero' },
  { path: 'plan', label: 'Plan' },
  { path: 'documents', label: 'Documentos' },
  { path: 'integrations', label: 'Integraciones' },
]
