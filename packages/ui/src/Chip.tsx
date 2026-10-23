import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { Icon } from './Icon'
import { Tick02Icon } from './icons'

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  pressed: boolean
  children: ReactNode
  /** On a card, so the unpressed chip doesn't vanish into the card. */
  inset?: boolean
}

/** A filter or toggle. Pressed is `primary` with a tick, so the state isn't color alone. */
export function Chip({ pressed, children, inset = false, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-control-sm items-center gap-1.5 rounded-pill px-3 text-label whitespace-nowrap transition-[color,background-color] duration-150',
        pressed ? 'bg-primary text-on-primary' : cn(inset ? 'bg-inset' : 'bg-surface', 'text-ink-muted hover:text-ink'),
        className,
      )}
      {...rest}
    >
      {pressed && <Icon icon={Tick02Icon} size={16} />}
      {children}
    </button>
  )
}
