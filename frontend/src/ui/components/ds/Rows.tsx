import type { ReactNode } from 'react'
import { cn } from './cn'
import { Icon } from './Icon'
import { ArrowDown01Icon } from './icons'

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

/** A row whose title opens its detail. Built on `<details>`, so Enter and Space open it. */
export function DisclosureRow({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <li>
      <details className="group rounded-md bg-inset">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md px-4 py-3 text-label [&::-webkit-details-marker]:hidden">
          {title}
          <Icon icon={ArrowDown01Icon} className="shrink-0 text-ink-muted group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-3 text-caption text-ink-muted">{children}</div>
      </details>
    </li>
  )
}
