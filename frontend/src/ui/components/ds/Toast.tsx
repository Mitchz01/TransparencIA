import { useToasts, type Toast } from '../../../application/toasts'
import { Button } from './Button'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { Alert02Icon, Cancel01Icon, InformationCircleIcon, RefreshIcon, Tick02Icon } from './icons'

const ICONS = { error: Alert02Icon, info: InformationCircleIcon, success: Tick02Icon } as const

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-lg bg-inverse py-3 pr-2 pl-5 text-on-inverse shadow-float"
    >
      <Icon icon={ICONS[toast.tone]} />
      <div className="grid min-w-0 flex-1">
        <span className="text-label">{toast.message}</span>
        {toast.requestId && <span className="text-caption tabular-nums opacity-80">Request {toast.requestId.slice(0, 8)}</span>}
      </div>
      {toast.action && (
        <Button
          variant="primary"
          size="sm"
          icon={RefreshIcon}
          onClick={() => {
            onDismiss()
            toast.action!.run()
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <IconButton icon={Cancel01Icon} label="Dismiss" size="sm" variant="quiet" tooltip="none" className="text-on-inverse opacity-80 hover:bg-transparent hover:text-on-inverse hover:opacity-100" onClick={onDismiss} />
    </div>
  )
}

/** Toasts float at the bottom center, above everything. */
export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  )
}
