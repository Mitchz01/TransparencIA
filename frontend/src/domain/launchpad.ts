// Rules of the home launchpad (spec 016): which projects are recent and the name a description suggests.

import { LIMITS, type ProjectSummary } from './project'

/** Newest first by creation date; `limit` keeps the first ones. */
export function recentProjects<T extends Pick<ProjectSummary, 'created_at'>>(projects: readonly T[], limit = Infinity): T[] {
  return [...projects].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, limit)
}

/** A starting name from the description's first words: "Una app de citas para clínicas veterinarias" → "App de citas para clínicas".
 *  A leading article goes, the first letter is capitalized and trailing punctuation is dropped. */
export function suggestProjectName(description: string, words = 5): string {
  const all = description.trim().split(/\s+/).filter(Boolean)
  if (/^(un|una|el|la|los|las|a|an|the)$/i.test(all[0] ?? '') && all.length > 1) all.shift()
  const name = all.slice(0, words).join(' ').replace(/[\s.,;:!?¡¿…]+$/u, '').replace(/^[¡¿]+/u, '')
  return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, LIMITS.name)
}

/** First name for the greeting, or null when there's none. */
export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null
