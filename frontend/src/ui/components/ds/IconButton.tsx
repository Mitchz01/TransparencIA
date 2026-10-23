import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'
import { Tooltip } from './Tooltip'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: IconGlyph
  /** Required: an icon-only button needs an accessible name (spec 009, FR-010). Also shown as a tooltip. */
  label: string
  size?: 'sm' | 'md'
  variant?: 'filled' | 'quiet'
  /** Where the tooltip opens; "none" when the label is already visible nearby. */
  tooltip?: 'below' | 'above' | 'none'
  tooltipAlign?: 'center' | 'end'
}

export function IconButton({
  icon, label, size = 'md', variant = 'filled', tooltip = 'below', tooltipAlign, className, type = 'button', ...rest
}: IconButtonProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type={type}
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center rounded-pill transition-[color,background-color,opacity] duration-150 disabled:opacity-50',
          size === 'md' ? 'size-control-md' : 'size-control-sm',
          variant === 'filled' ? 'bg-surface-strong text-ink hover:opacity-80' : 'text-ink-muted hover:bg-surface-strong hover:text-ink',
          className,
        )}
        {...rest}
      >
        <Icon icon={icon} size={20} />
      </button>
      {tooltip !== 'none' && <Tooltip text={label} placement={tooltip} align={tooltipAlign} />}
    </span>
  )
}
