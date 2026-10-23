// Dates and amounts in words, in Spanish (design system, "Voice"): "23 oct", "2 miembros", "5 pts".

const dateFormat = new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' })

/** "23 oct" for an ISO date or datetime. */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)).replace('.', '')

/** "Recién", "hace 5 min", "15:40", or "23 oct" for older ones. */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  const minutes = Math.floor((now - then) / 60000)
  if (minutes < 1) return 'Recién'
  if (minutes < 60) return `Hace ${minutes} min`
  if (new Date(then).toDateString() === new Date(now).toDateString()) return timeFormat.format(then)
  return formatDate(iso)
}

/** "1 miembro", "2 miembros"; pass the plural when it isn't the singular plus "s" ("decisión", "decisiones"). */
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

export const points = (count: number) => `${count} ${count === 1 ? 'pt' : 'pts'}`

/** Ends a phrase with one period, whether or not the agent wrote it: "Rápido para iterar." */
export const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)

/** Joins phrases into sentences: "Diaria, 15 min. Destrabar." */
export const sentences = (...parts: string[]) => parts.filter((p) => p.trim()).map(sentence).join(' ')
