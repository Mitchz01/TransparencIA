// Spec 017, US2 (owner: P4): a person reviews what the AI read before anything is public (FR-006).

import { useState, type FormEvent } from 'react'
import { TRANSPARENCY_LIMITS, type AlertLevel, type Expense, type ExpenseConfirmation, type ExpenseKind, type LineStatus } from '@agile/domain'
import { Button, Icon, NumberField, Pill, Select, TextArea, TextField, type Hue } from '@agile/ui'
import { AiMagicIcon, Alert02Icon, Delete02Icon, File01Icon, Tick02Icon } from '@agile/ui/icons'
import type { FieldErrors } from '../../../application/use-cases/useApiErrorToast'
import { formatAmountInput, parseAmount } from './money'

const KINDS: { value: ExpenseKind; label: string }[] = [
  { value: 'invoice', label: 'Factura' },
  { value: 'field_photo', label: 'Foto de campo' },
  { value: 'report', label: 'Informe' },
]

const LEVELS: Record<AlertLevel, { hue: Hue; label: string }> = {
  high: { hue: 'coral', label: 'Alta' },
  medium: { hue: 'amber', label: 'Media' },
  low: { hue: 'neutral', label: 'Baja' },
}

const NONE = ''

const toConfirmation = (draft: Expense): ExpenseConfirmation => ({
  kind: draft.kind,
  amount: draft.amount,
  date: draft.date,
  supplier: draft.supplier,
  concept: draft.concept,
  budget_line_id: draft.budget_line_id,
  task_id: draft.task_id,
  citizen_summary: draft.citizen_summary,
})

const orNull = (text: string | null) => (text?.trim() ? text.trim() : null)

function Preview({ draft }: { draft: Expense }) {
  if (draft.mime.startsWith('image/')) {
    return <img src={draft.file_url} alt="Evidencia subida" className="max-h-72 w-full rounded-md bg-inset object-contain" />
  }
  return (
    <a href={draft.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md bg-inset px-4 py-6 text-label text-accent-ink hover:bg-surface-strong">
      <Icon icon={File01Icon} />
      Abrir el documento
    </a>
  )
}

interface ExpenseReviewFormProps {
  draft: Expense
  lines: LineStatus[]
  tasks: { id: number; title: string }[]
  onConfirm: (body: ExpenseConfirmation) => Promise<FieldErrors>
  onDiscard: () => void
  discarding?: boolean
}

export function ExpenseReviewForm({ draft, lines, tasks, onConfirm, onDiscard, discarding = false }: ExpenseReviewFormProps) {
  const [form, setForm] = useState<ExpenseConfirmation>(() => toConfirmation(draft))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<ExpenseConfirmation>) => setForm((f) => ({ ...f, ...patch }))
  const photo = form.kind === 'field_photo'

  // The board may no longer have the task the AI picked: keep it as an option with its saved title.
  const taskOptions = [...tasks]
  if (form.task_id !== null && !tasks.some((t) => t.id === form.task_id)) taskOptions.unshift({ id: form.task_id, title: draft.task_title ?? `Tarea ${form.task_id}` })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const summary = form.citizen_summary.trim()
    if (!summary) {
      setErrors({ citizen_summary: 'Escribe una frase para los ciudadanos.' })
      return
    }
    setSaving(true)
    const result = await onConfirm({
      ...form,
      amount: photo ? null : form.amount,
      supplier: orNull(form.supplier),
      concept: orNull(form.concept),
      citizen_summary: summary,
    })
    setSaving(false)
    setErrors(result)
  }

  return (
    <form className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr]" onSubmit={submit} noValidate aria-label={`Borrador ${draft.supplier ?? draft.concept ?? draft.id}`}>
      <div className="grid content-start gap-3">
        <Preview draft={draft} />
        <p className="inline-flex items-center gap-2 text-caption text-ink-muted">
          <Icon icon={AiMagicIcon} size={16} />
          Lo leyó la IA. Revisa cada campo: nada se publica hasta que confirmes.
        </p>
      </div>

      <div className="grid content-start gap-4">
        {draft.alerts.length > 0 && (
          <ul className="grid gap-1.5" aria-label="Alertas de la IA">
            {draft.alerts.map((alert) => (
              <li key={alert.id} className="grid gap-2 rounded-md bg-inset px-4 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <Pill hue="violet" icon={AiMagicIcon}>IA</Pill>
                  <Pill hue={LEVELS[alert.level].hue} icon={Alert02Icon}>{LEVELS[alert.level].label}</Pill>
                </span>
                <span className="text-body">{alert.reason}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo" options={KINDS} value={form.kind} error={errors.kind}
            onChange={(e) => set({ kind: e.target.value as ExpenseKind })} />
          {photo ? (
            <TextField label="Monto" value="Sin monto: es evidencia de una actividad" disabled />
          ) : (
            <NumberField label="Monto" unit="COP" placeholder="0" value={formatAmountInput(form.amount)} error={errors.amount}
              onChange={(e) => set({ amount: parseAmount(e.target.value) })} />
          )}
          <TextField label="Fecha" type="date" value={form.date ?? ''} error={errors.date}
            onChange={(e) => set({ date: e.target.value || null })} />
          <TextField label="Proveedor" value={form.supplier ?? ''} error={errors.supplier}
            onChange={(e) => set({ supplier: e.target.value || null })} />
          <TextField label="Concepto" className="sm:col-span-2" value={form.concept ?? ''} error={errors.concept}
            onChange={(e) => set({ concept: e.target.value || null })} />
          <Select label="Rubro" value={form.budget_line_id ?? NONE} error={errors.budget_line_id}
            options={[{ value: NONE, label: 'Sin rubro' }, ...lines.map((l) => ({ value: l.id, label: l.name }))]}
            onChange={(e) => set({ budget_line_id: e.target.value || null })} />
          <Select label="Actividad del tablero" value={form.task_id === null ? NONE : String(form.task_id)} error={errors.task_id}
            options={[{ value: NONE, label: 'Sin actividad' }, ...taskOptions.map((t) => ({ value: String(t.id), label: t.title }))]}
            onChange={(e) => set({ task_id: e.target.value ? Number(e.target.value) : null })} />
          <TextArea label="Resumen para ciudadanos" className="sm:col-span-2" rows={2} maxLength={TRANSPARENCY_LIMITS.citizenSummary}
            hint={`Una frase simple. ${form.citizen_summary.length} de ${TRANSPARENCY_LIMITS.citizenSummary} caracteres.`}
            value={form.citizen_summary} error={errors.citizen_summary}
            onChange={(e) => set({ citizen_summary: e.target.value })} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" icon={Delete02Icon} loading={discarding} disabled={saving} onClick={onDiscard}>Descartar</Button>
          <Button type="submit" variant="primary" icon={Tick02Icon} loading={saving} disabled={discarding}>Confirmar y publicar</Button>
        </div>
      </div>
    </form>
  )
}
