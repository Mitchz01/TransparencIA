// Formats for spec 017's numbers. The numbers themselves come from the backend's rules (SC-003).

const copFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortDateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Pesos without cents: "$ 30.000.000". */
export const cop = (amount: number) => copFormat.format(amount)

/** A percentage with at most one decimal: "18,5 %". */
export const pct = (value: number) => `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

/** An ISO date ("2026-08-03") as "3 ago 2026"; dates carry no time, so they're read as UTC. */
export const day = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))

export const shortDay = (iso: string) => shortDateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))

const DAY_MS = 86_400_000
const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)

/** An ISO date plus `days`, as ISO again. */
export const addDays = (iso: string, days: number) => new Date(utc(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10)

/** Whole days from `from` to `to` (both ISO dates). */
export const daysBetween = (from: string, to: string) => Math.round((utc(to).getTime() - utc(from).getTime()) / DAY_MS)

/** A Monday-to-Sunday week as "14–20 sept", or "28 sept–4 oct" when it spans two months. */
export const weekRange = (weekStart: string) => {
  const end = addDays(weekStart, 6)
  const sameMonth = utc(weekStart).getUTCMonth() === utc(end).getUTCMonth()
  return sameMonth ? `${utc(weekStart).getUTCDate()}–${shortDay(end)}` : `${shortDay(weekStart)}–${shortDay(end)}`
}

/** "sept", for the chart's month ticks. */
export const month = (iso: string) => monthFormat.format(utc(iso)).replace('.', '')

/** Large amounts in words a citizen reads at a glance: "$ 32,4 millones". Below a million, the full amount. */
export const copShort = (amount: number) =>
  Math.abs(amount) < 1_000_000
    ? cop(amount)
    : `$ ${(amount / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} millones`
