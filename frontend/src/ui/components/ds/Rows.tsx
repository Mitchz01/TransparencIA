import type { ReactNode } from 'react'
import { cn } from './cn'

/** A titled group inside a card. The title is a label, never a small caps tag over it. */
export function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-2', className)}>
      <h3 className="text-label text-ink">{title}</h3>
      {children}
    </section>
  )
}

/** Rows separated by space, never by lines. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="grid gap-1.5">{children}</ul>
}

/** One row on `inset`: a title, an optional detail under it, and something on the right. */
export function Row({ title, detail, aside }: { title: ReactNode; detail?: ReactNode; aside?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-md bg-inset px-4 py-3">
      <span className="grid min-w-0 gap-0.5">
        <span className="text-label">{title}</span>
        {detail && <span className="text-caption text-ink-muted">{detail}</span>}
      </span>
      {aside}
    </li>
  )
}
