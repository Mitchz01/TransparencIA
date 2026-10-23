// Mirrors PublicProjectCard of apps/api/app/application/use_cases/transparency/search_public_projects.py
// (spec 017, US8, "GET /api/public/projects?q="). Owner: P5.

import type { Light } from './transparency'

export interface PublicProjectCard {
  slug: string
  name: string
  description: string
  contracting_entity: string
  contractor: string
  contract_value: number
  start_date: string
  end_date: string
  light: Light
  spent_pct: number
  physical_pct: number | null // null when the project has no task points
  time_pct: number
  open_alerts: number
}

export const SEARCH_QUERY_MAX = 100
