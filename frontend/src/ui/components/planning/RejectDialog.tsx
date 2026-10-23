import { useRef, useState, type FormEvent } from 'react'
import { REASON_MAX } from '../../../domain/proposals'
import type { FieldErrors } from '../../../domain/rules'
import { Button, Dialog, TextArea } from '../ds'

interface RejectDialogProps {
  what: string // "the roadmap"
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
      setError('Write a reason so the agent can do better.')
      field.current?.focus()
      return
    }
    if (clean.length > REASON_MAX) {
      setError(`Keep it under ${REASON_MAX} characters.`)
      return
    }
    setSending(true)
    const errors = await onReject(clean)
    setSending(false)
    if (errors.reason) setError(errors.reason)
    else onClose()
  }

  return (
    <Dialog title={`Reject ${what}`} description="The agent tries again with your reason." onClose={onClose} initialFocus={field}>
      <form noValidate onSubmit={submit} className="grid gap-5">
        <TextArea
          ref={field}
          label="Reason"
          value={reason}
          error={error}
          hint={`Up to ${REASON_MAX} characters.`}
          placeholder="What should the agent change?"
          onChange={(e) => {
            setReason(e.target.value)
            setError(undefined)
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={sending}>Reject</Button>
        </div>
      </form>
    </Dialog>
  )
}
