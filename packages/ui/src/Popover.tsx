import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'
import { ArrowDown01Icon } from './icons'

interface PopoverProps {
  /** What the button shows. */
  trigger: ReactNode
  /** The button's and the panel's accessible name ("Filtrar, 2 activos"). */
  label: string
  children: ReactNode
  icon?: IconGlyph
  variant?: ButtonVariant
  size?: ButtonSize
  align?: 'start' | 'end'
  /** The chevron after the trigger; off when the trigger ends in its own arrow. */
  chevron?: boolean
  buttonClassName?: string
}

/** A button that opens a panel next to it, for content richer than a menu (the board filters).
 *  Not modal: Tab moves through it, Escape or a click outside closes it and the focus goes back to the button. */
export function Popover({ trigger, label, children, icon, variant = 'secondary', size = 'md', align = 'start', chevron = true, buttonClassName }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    panel.current?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus()
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  return (
    <div ref={root} className="relative inline-flex">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen(!open)}
        className={buttonClasses(variant, size, cn('max-w-full', buttonClassName))}
      >
        {icon && <Icon icon={icon} />}
        {trigger}
        {chevron && <Icon icon={ArrowDown01Icon} className="text-ink-muted" />}
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            button.current?.focus()
          }}
          className={cn(
            'absolute top-full z-40 mt-2 grid max-h-[70svh] w-max max-w-[calc(100vw-32px)] min-w-64 gap-4 overflow-y-auto rounded-lg bg-surface p-4 shadow-float',
            align === 'start' ? 'left-0' : 'right-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
