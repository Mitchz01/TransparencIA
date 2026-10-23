import type { ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'

interface EmptyStateProps {
  icon: IconGlyph
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

/** Says what's missing and links to where it's made. Never an empty grid. */
export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn('grid justify-items-center gap-3 rounded-lg bg-surface px-6 py-12 text-center', className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-md bg-surface-strong text-ink">
        <Icon icon={icon} size={24} />
      </span>
      <h2 className="text-heading">{title}</h2>
      {children && <p className="max-w-sm text-body text-ink-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
