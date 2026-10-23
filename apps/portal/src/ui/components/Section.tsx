import type { ReactNode } from 'react'

/** A portal section: a heading, one line on how to read it, and its content. */
export function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-16 gap-3">
      <div className="grid gap-1 px-1">
        <h2 id={`${id}-title`} className="text-heading">
          {title}
        </h2>
        {hint && <p className="text-caption text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}
