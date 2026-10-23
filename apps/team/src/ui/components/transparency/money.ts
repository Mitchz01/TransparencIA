// Pesos and dates for the Transparencia tab (spec 017): "$1.850.000", "3 ago 2026".

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const longDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

/** "$1.850.000"; negatives as "-$1.850.000". */
export const cop = (amount: number) => `${amount < 0 ? '-' : ''}$${pesos.format(Math.abs(amount))}`

/** What a peso field shows while typing: digits grouped with dots, empty for null. */
export const formatAmountInput = (amount: number | null) => (amount === null ? '' : pesos.format(amount))

/** Back from the field: only the digits count; empty is null. */
export const parseAmount = (text: string): number | null => {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/** "3 ago 2026" for an ISO date. */
export const formatLongDate = (iso: string) => longDate.format(new Date(`${iso.slice(0, 10)}T12:00:00`)).replace('.', '')

/** The contract's last day, inclusive, as the backend's `end_date`: 26 weeks from Monday 2026-08-03 end on Sunday 2027-01-31. */
export const endDateFor = (start: string, weeks: number) => {
  if (!start) return ''
  const date = new Date(`${start}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7 - 1)
  return date.toISOString().slice(0, 10)
}
