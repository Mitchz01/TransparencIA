import type { ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'
import { ArrowDown02Icon, ArrowRight02Icon } from './icons'

export interface FlowStep {
  key: string
  title: string
  icon?: IconGlyph
  caption?: ReactNode
  detail?: ReactNode
}

/** Steps on `inset` joined by arrows: across on wide screens, down on narrow ones. No lines. */
export function Flow({ steps, label }: { steps: FlowStep[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col items-stretch gap-2 md:flex-row">
      {steps.map((step, i) => (
        <li key={step.key} className="flex flex-1 flex-col items-center gap-2 md:flex-row md:items-stretch">
          {i > 0 && (
            <span aria-hidden="true" className="flex shrink-0 items-center text-ink-muted">
              <Icon icon={ArrowDown02Icon} className="md:hidden" />
              <Icon icon={ArrowRight02Icon} className="hidden md:block" />
            </span>
          )}
          <div className="grid w-full flex-1 content-start gap-1 rounded-md bg-inset p-4">
            <span className="flex items-center gap-2 text-label">
              {step.icon && <Icon icon={step.icon} className="shrink-0 text-ink-muted" />}
              {step.title}
            </span>
            {step.caption && <span className="text-caption text-ink-muted">{step.caption}</span>}
            {step.detail && <span className="text-caption text-ink-muted">{step.detail}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

const MAX_SLOTS = 12

/** One square per allowed item, with the limit in words next to it. "Sin límite" when there's none. */
export function Slots({ limit, className }: { limit: number | null; className?: string }) {
  if (limit === null) return <span className={cn('text-caption text-ink-muted', className)}>Sin límite</span>
  return (
    <span className={cn('grid gap-1.5', className)}>
      <span aria-hidden="true" className="flex flex-wrap gap-1">
        {Array.from({ length: Math.min(limit, MAX_SLOTS) }, (_, i) => (
          <span key={i} className="size-3 rounded-[4px] bg-ink-subtle/45" />
        ))}
      </span>
      <span className="text-caption text-ink-muted tabular-nums">Máximo {limit} a la vez</span>
    </span>
  )
}
