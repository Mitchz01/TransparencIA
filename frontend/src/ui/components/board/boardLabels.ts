import type { Priority, TaskStatus, TaskType } from '../../../domain/board'
import type { Hue } from '../ds'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  in_progress: 'En curso',
  review: 'En revisión',
  done: 'Hecho',
}

export const PRIORITY_LOOK: Record<Priority, { label: string; hue: Hue }> = {
  high: { label: 'Alta', hue: 'coral' },
  medium: { label: 'Media', hue: 'amber' },
  low: { label: 'Baja', hue: 'teal' },
}

export const TYPE_LABELS: Record<TaskType, string> = { feature: 'Funcionalidad', bug: 'Error', chore: 'Tarea técnica', spike: 'Investigación' }
