import { cn } from './cn'

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/** Initials on `surface-strong`. The name is always written next to it (visible or for screen readers only), so the initials stay hidden from them. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-strong text-caption font-semibold text-ink', className)}
    >
      {initials(name)}
    </span>
  )
}
