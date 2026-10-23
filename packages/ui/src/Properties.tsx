import type { ReactNode } from 'react'
import { Icon, type IconGlyph } from './Icon'

/** A list of properties: name on the left, value on the right. Rows are spaced, never lined. */
export function PropertyRows({ children }: { children: ReactNode }) {
  return <dl className="grid gap-1">{children}</dl>
}

/** One property. The value is a quiet menu, an inline field or plain text. */
export function Property({ label, icon, children }: { label: string; icon: IconGlyph; children: ReactNode }) {
  return (
    <div className="flex min-h-control-md items-center gap-3">
      <dt className="flex w-32 shrink-0 items-center gap-2 text-label text-ink-muted">
        <Icon icon={icon} />
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-center">{children}</dd>
    </div>
  )
}
