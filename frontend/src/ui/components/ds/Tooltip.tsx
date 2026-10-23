import { cn } from './cn'

export interface TooltipPosition {
  placement?: 'below' | 'above' | 'right'
  /** "end" keeps it inside the screen for buttons on the right edge. */
  align?: 'center' | 'end'
}

/** A short label on `inverse` that appears when its `group` parent is hovered or focused. Visual only. */
export function Tooltip({ text, placement = 'below', align = 'center' }: { text: string } & TooltipPosition) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-50 whitespace-nowrap rounded-sm bg-inverse px-2.5 py-1 text-caption text-on-inverse opacity-0 transition-opacity duration-150',
        'group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
        placement === 'right'
          ? 'top-1/2 left-full ml-3 -translate-y-1/2'
          : cn(placement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2', align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'),
      )}
    >
      {text}
    </span>
  )
}
