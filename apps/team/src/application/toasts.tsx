// Short messages at the bottom of the screen: errors with a retry and the request id, and confirmations.
// ui/components/shell/Toaster.tsx renders them.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastInput {
  tone?: 'error' | 'info' | 'success'
  message: string
  requestId?: string
  action?: { label: string; run: () => void }
}

export interface Toast extends ToastInput {
  id: number
  tone: NonNullable<ToastInput['tone']>
}

interface ToastState {
  toasts: Toast[]
  push: (toast: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastState | null>(null)

const VISIBLE_MS = 6000
const WITH_ACTION_MS = 10000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      // The same message twice in a row replaces the old one instead of stacking.
      setToasts((all) => [...all.filter((t) => t.message !== input.message).slice(-2), { tone: 'info', ...input, id }])
      setTimeout(() => dismiss(id), input.action ? WITH_ACTION_MS : VISIBLE_MS)
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToasts(): ToastState {
  const state = useContext(ToastContext)
  if (!state) throw new Error('useToasts needs a ToastProvider')
  return state
}
