import { useRef, type KeyboardEvent } from 'react'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: IconGlyph
}

interface SegmentedProps<T extends string> {
  label: string
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  /** On a card, the group sits on `inset` instead of `surface`. */
  inset?: boolean
  disabled?: boolean
}

/** One choice out of a few (views, Off / On). The selected segment is `inverse`. */
export function Segmented<T extends string>({ label, options, value, onChange, size = 'md', inset = false, disabled = false }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={cn('inline-flex gap-1 rounded-pill p-1', inset ? 'bg-inset' : 'bg-surface', disabled && 'opacity-50')}>
      {options.map((option, i) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill text-label whitespace-nowrap transition-[color,background-color] duration-150',
              size === 'md' ? 'h-control-md px-4' : 'h-control-sm px-3',
              selected ? 'bg-inverse text-on-inverse' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.icon && <Icon icon={option.icon} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
