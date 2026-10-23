import { useRef, useState, type FormEvent } from 'react'
import { REASON_MAX } from '../../../domain/proposals'
import type { FieldErrors } from '../../../domain/rules'
import { Button, Dialog, TextArea } from '@agile/ui'

interface RejectDialogProps {
  what: string // "el roadmap"
  onReject: (reason: string) => Promise<FieldErrors>
  onClose: () => void
}

/** The agent redoes the stage with this reason, so it can't be empty (1 to 1000 characters). */
export function RejectDialog({ what, onReject, onClose }: RejectDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = reason.trim()
    if (!clean) {
      setError('Escribe un motivo para que el agente lo haga mejor.')
      field.current?.focus()
      return
    }
    if (clean.length > REASON_MAX) {
      setError(`Usa menos de ${REASON_MAX} caracteres.`)
      return
    }
    setSending(true)
    const errors = await onReject(clean)
    setSending(false)
    if (errors.reason) setError(errors.reason)
    else onClose()
  }

  return (
    <Dialog title={`Rechazar ${what}`} description="El agente lo vuelve a intentar con tu motivo." onClose={onClose} initialFocus={field}>
      <form noValidate onSubmit={submit} className="grid gap-5">
        <TextArea
          ref={field}
          label="Motivo"
          value={reason}
          error={error}
          hint={`Hasta ${REASON_MAX} caracteres.`}
          placeholder="¿Qué debería cambiar el agente?"
          onChange={(e) => {
            setReason(e.target.value)
            setError(undefined)
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={sending}>Rechazar</Button>
        </div>
      </form>
    </Dialog>
  )
}
