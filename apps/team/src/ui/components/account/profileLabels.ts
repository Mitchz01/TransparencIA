import type { Seniority } from '../../../domain/project'

/** The roles most teams have; anything else is typed under "Otro". */
export const COMMON_ROLES = ['Frontend', 'Backend', 'Fullstack', 'Diseño', 'QA', 'DevOps', 'Producto'] as const

export const SENIORITY_LABELS: Record<Seniority, string> = { junior: 'Junior', mid: 'Semisenior', senior: 'Senior' }

export const PROFILE_HINT = 'Si lo omites: semisenior y 20 horas por semana. Puedes cambiarlo cuando quieras.'
