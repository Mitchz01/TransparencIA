import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { cn } from './cn'

export type IconGlyph = IconSvgElement

interface IconProps {
  icon: IconGlyph
  /** 16 inside pills and metadata, 20 inside buttons, inputs and cards, 24 in navigation and headers. */
  size?: 16 | 20 | 24
  className?: string
  /** Only for an icon that carries meaning on its own; decorative icons stay hidden from screen readers. */
  label?: string
}

export function Icon({ icon, size = 20, className, label }: IconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={1.5}
      color="currentColor"
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
