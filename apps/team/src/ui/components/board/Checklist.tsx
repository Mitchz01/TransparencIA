import { useState, type FormEvent } from 'react'
import { TASK_LIMITS, type ChecklistItem } from '../../../domain/board'
import { checklistProgress } from '../../../domain/rules'
import { Button, Checkbox, FieldError, IconButton, ProgressTrack, TextField } from '@agile/ui'
import { Add01Icon, Delete02Icon } from '@agile/ui/icons'

interface ChecklistProps {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
  errors?: Record<string, string>
}

/** Check, add and remove items. Every change is saved at once. */
export function Checklist({ items, onChange, errors = {} }: ChecklistProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const progress = checklistProgress(items)

  const add = (event: FormEvent) => {
    event.preventDefault()
    const clean = text.trim()
    if (!clean) return setError('Escribe el ítem.')
    if (clean.length > TASK_LIMITS.checklistText) return setError(`Máximo ${TASK_LIMITS.checklistText} caracteres.`)
    if (items.length >= TASK_LIMITS.checklistItems) return setError(`Máximo ${TASK_LIMITS.checklistItems} pasos.`)
    onChange([...items, { text: clean, done: false }])
    setText('')
    setError(undefined)
  }

  return (
    <section className="grid gap-3" aria-label="Pasos">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-label">Pasos</h3>
        <span className="text-caption text-ink-muted tabular-nums">{progress.done} de {progress.total}</span>
      </div>
      {progress.total > 0 && <ProgressTrack value={progress.done} max={progress.total} label={`Pasos ${progress.done} de ${progress.total}`} />}
      <ul className="grid gap-1">
        {items.map((item, i) => (
          <li key={`${i}-${item.text}`} className="flex items-start justify-between gap-2 rounded-md px-1 py-1.5">
            <div className="grid gap-1">
              <Checkbox
                label={item.text}
                strike
                checked={item.done}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
              />
              {errors[`items[${i}].text`] && <FieldError>{errors[`items[${i}].text`]}</FieldError>}
            </div>
            <IconButton icon={Delete02Icon} label={`Quitar "${item.text}"`} size="sm" variant="quiet" tooltip="none" onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate className="flex items-start gap-2">
        <TextField
          label="Nuevo ítem"
          hideLabel
          size="md"
          className="flex-1"
          placeholder="Agregar un ítem"
          value={text}
          error={error}
          onChange={(e) => {
            setText(e.target.value)
            setError(undefined)
          }}
        />
        <Button type="submit" icon={Add01Icon}>Agregar</Button>
      </form>
    </section>
  )
}
