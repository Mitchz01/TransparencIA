import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { IconButton } from './IconButton'
import { Cancel01Icon } from './icons'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Focus moves in and stays inside, Escape closes, focus goes back to where it was, the page doesn't scroll. */
function useModal(panel: RefObject<HTMLElement | null>, onClose: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const first = initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const [head, tail] = [items[0], items[items.length - 1]]
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault()
        tail.focus()
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault()
        head.focus()
      }
    }
    node?.addEventListener('keydown', onKeyDown)
    return () => {
      node?.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [panel, initialFocus])
}

interface OverlayProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Buttons at the bottom right. */
  actions?: ReactNode
  initialFocus?: RefObject<HTMLElement | null>
  description?: string
}

export function Dialog({ title, onClose, children, actions, initialFocus, description }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(panel, onClose, initialFocus)
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-3 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="grid max-h-[calc(100svh-24px)] w-full max-w-md gap-5 overflow-y-auto rounded-xl bg-surface p-6 shadow-float outline-none sm:p-8"
      >
        <div className="grid gap-1">
          <h2 id={titleId} className="text-heading">
            {title}
          </h2>
          {description && <p className="text-body text-ink-muted">{description}</p>}
        </div>
        {children}
        {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ title, onClose, children, actions, initialFocus, wide = false }: OverlayProps & { wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(panel, onClose, initialFocus)
  return createPortal(
    <div className="fixed inset-0 z-50 bg-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-3 right-3 flex w-[calc(100vw-24px)] flex-col rounded-xl bg-surface shadow-float outline-none',
          wide ? 'max-w-xl' : 'max-w-md',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-heading">
            {title}
          </h2>
          <IconButton icon={Cancel01Icon} label="Cerrar" variant="quiet" tooltip="none" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {actions && <div className="flex flex-wrap justify-end gap-2 px-6 pb-5">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}
