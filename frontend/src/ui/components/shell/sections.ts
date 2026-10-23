export interface Section {
  path: string
  label: string
}

/** The project sections, in top bar order (spec 009, screen map). Settings is an icon button. */
export const SECTIONS: Section[] = [
  { path: 'planning', label: 'Planning' },
  { path: 'board', label: 'Board' },
  { path: 'plan', label: 'Plan' },
  { path: 'documents', label: 'Documents' },
  { path: 'integrations', label: 'Integrations' },
]
