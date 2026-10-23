// Dates and amounts in words (design system, "Voice"): "Oct 23", "2 members", "5 pts".

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

/** "Oct 23" for an ISO date or datetime. */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso))

/** "Just now", "5 min ago", "3:40 PM", or "Oct 23" for older ones. */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  const minutes = Math.floor((now - then) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (new Date(then).toDateString() === new Date(now).toDateString()) return timeFormat.format(then)
  return formatDate(iso)
}

/** "1 member", "2 members". */
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

export const points = (count: number) => `${count} ${count === 1 ? 'pt' : 'pts'}`
