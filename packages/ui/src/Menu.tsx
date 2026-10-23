import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'
import { ArrowDown01Icon, Tick02Icon } from './icons'

export interface MenuItem {
  key: string
  label: string
  caption?: string
  icon?: IconGlyph
  selected?: boolean
  onSelect: () => void
}

interface MenuProps {
  /** What the button shows. */
  children: ReactNode
  /** The button's accessible name when its content isn't enough (e.g. "Sprint: Sprint 2"). */
  label?: string
  items: MenuItem[]
  /** Extra rows after the items, like "New project". */
  footer?: MenuItem[]
  /** Text above the items that isn't a choice (the account menu's name and email). */
  header?: ReactNode
  /** The chevron after the content; off when the button is only an avatar. */
  chevron?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  align?: 'start' | 'end'
  icon?: IconGlyph
  className?: string
  buttonClassName?: string
}

/** A button with a chevron that opens a list of choices. Arrow keys move, Enter picks, Escape closes. */
export function Menu({
  children, label, items, footer = [], header, chevron = true, variant = 'secondary', size = 'md', align = 'start', icon, className, buttonClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const rows = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const all = [...items, ...footer]

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  useEffect(() => {
    if (open) rows.current[active]?.focus()
  }, [open, active])

  const openAt = (index: number) => {
    setActive(Math.max(0, index))
    setOpen(true)
  }

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(event.key === 'ArrowDown' ? Math.max(0, all.findIndex((i) => i.selected)) : all.length - 1)
    }
  }

  const onMenuKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : all.length - 1)
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  const row = (item: MenuItem, index: number) => (
    <button
      key={item.key}
      ref={(el) => {
        rows.current[index] = el
      }}
      type="button"
      role={item.selected === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={item.selected === undefined ? undefined : item.selected}
      tabIndex={index === active ? 0 : -1}
      onClick={() => {
        close()
        item.onSelect()
      }}
      className="flex min-h-control-md w-full items-center gap-3 rounded-pill px-3 py-1.5 text-left text-label text-ink transition-[background-color] duration-150 hover:bg-surface-strong focus-visible:bg-surface-strong focus-visible:outline-none"
    >
      {item.icon && <Icon icon={item.icon} className="text-ink-muted" />}
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{item.label}</span>
        {item.caption && <span className="truncate text-caption text-ink-muted">{item.caption}</span>}
      </span>
      {item.selected && <Icon icon={Tick02Icon} />}
    </button>
  )

  return (
    <div ref={root} className={cn('relative inline-flex', className)}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : openAt(Math.max(0, all.findIndex((i) => i.selected))))}
        onKeyDown={onButtonKey}
        className={buttonClasses(variant, size, cn('max-w-full', buttonClassName))}
      >
        {icon && <Icon icon={icon} />}
        <span className="min-w-0 truncate">{children}</span>
        {chevron && <Icon icon={ArrowDown01Icon} className="text-ink-muted" />}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKey}
          className={cn(
            'absolute top-full z-40 mt-2 grid max-h-[60svh] w-max max-w-[calc(100vw-32px)] min-w-56 gap-0.5 overflow-y-auto rounded-lg bg-surface p-2 shadow-float',
            align === 'start' ? 'left-0' : 'right-0',
          )}
        >
          {header && <div className="grid gap-0.5 px-3 pt-2 pb-3">{header}</div>}
          {items.map(row)}
          {footer.length > 0 && <div className="mt-1 grid gap-0.5 rounded-md bg-inset p-1">{footer.map((item, i) => row(item, items.length + i))}</div>}
        </div>
      )}
    </div>
  )
}
