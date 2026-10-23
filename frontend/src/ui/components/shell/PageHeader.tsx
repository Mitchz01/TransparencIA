import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

/** One title per screen, an optional sentence under it, the actions on the right. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-6 pb-6 md:pt-10 md:pb-8">
      <div className="grid min-w-0 gap-1.5">
        <h1 className="text-title">{title}</h1>
        {description && <p className="max-w-2xl text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
