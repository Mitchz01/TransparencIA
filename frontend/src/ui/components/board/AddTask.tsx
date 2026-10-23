import { useId, useState, type KeyboardEvent } from 'react'
import type { FieldErrors } from '../../../application/use-cases/useApiErrorToast'
import { TASK_LIMITS } from '../../../domain/board'
import { Button, FieldError } from '../ds'
import { Add01Icon } from '../ds/icons'

interface AddTaskProps {
  /** The column's name, for the field's accessible name. */
  column: string
  onCreate: (title: string) => Promise<{ created: boolean; errors: FieldErrors }>
}

/** "Agregar tarea" at the end of a column (spec 014): a title field that creates on Enter and stays
 *  open for the next one. Escape, or leaving it empty, closes it; a failure keeps what was typed. */
export function AddTask({ column, onCreate }: AddTaskProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const errorId = useId()

  const close = () => {
    setOpen(false)
    setTitle('')
    setError(undefined)
  }

  const submit = async () => {
    const text = title.trim()
    if (!text) return close()
    if (text.length > TASK_LIMITS.title) return setError(`Entre 1 y ${TASK_LIMITS.title} caracteres.`)
    setSaving(true)
    const { created, errors } = await onCreate(text)
    setSaving(false)
    if (created) {
      setTitle('')
      setError(undefined)
    } else {
      setError(errors.title ?? Object.values(errors)[0])
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !saving) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  if (!open) {
    return (
      <Button variant="quiet" size="sm" icon={Add01Icon} className="w-full justify-start" onClick={() => setOpen(true)}>
        Agregar tarea
      </Button>
    )
  }

  return (
    <div className="grid gap-2 rounded-md bg-card p-3">
      <input
        autoFocus
        value={title}
        readOnly={saving}
        aria-label={`Nueva tarea en ${column}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="¿Qué hay que hacer?"
        className="w-full min-w-0 rounded-sm bg-transparent px-1 py-1 text-label font-normal text-ink placeholder:text-ink-muted"
        onChange={(e) => {
          setTitle(e.target.value)
          setError(undefined)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!title.trim()) close()
        }}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}
