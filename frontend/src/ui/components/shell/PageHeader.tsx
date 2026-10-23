import type { ReactNode } from 'react'
import { cn } from '../ds'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /** Title and sentence on one line with less space around, for screens whose content has to start high (the board). */
  compact?: boolean
}

/** One title per screen, an optional sentence under it, the actions on the right. */
export function PageHeader({ title, description, actions, compact = false }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap justify-between gap-x-6', compact ? 'items-center gap-y-3 pt-2 pb-4 md:pt-4' : 'items-end gap-y-4 pt-6 pb-6 md:pt-10 md:pb-8')}>
      <div className={cn('min-w-0', compact ? 'flex flex-wrap items-baseline gap-x-3 gap-y-1' : 'grid gap-1.5')}>
        <h1 className="text-title">{title}</h1>
        {description && <p className={cn('text-ink-muted', compact ? 'text-label font-normal' : 'max-w-2xl text-body')}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
