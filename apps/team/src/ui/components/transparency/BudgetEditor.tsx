// Spec 017, US1 (owner: P4): the contract's money. Leaders edit it; members read it.

import { useState, type FormEvent } from 'react'
import type { Budget, BudgetInput, BudgetLine } from '@agile/domain'
import { TRANSPARENCY_LIMITS } from '@agile/domain'
import { Button, IconButton, NumberField, Property, PropertyRows, TextField, cn } from '@agile/ui'
import { Add01Icon, Calendar03Icon, Coins01Icon, Delete02Icon, Edit02Icon, Flag02Icon, UserGroupIcon } from '@agile/ui/icons'
import type { FieldErrors } from '../../../application/use-cases/useApiErrorToast'
import { cop, endDateFor, formatAmountInput, formatLongDate, parseAmount } from './money'

interface Draft {
  contracting_entity: string
  contractor: string
  contract_value: number | null
  start_date: string
  lines: { id: string; name: string; amount: number | null }[]
}

const toDraft = (budget: Budget | null): Draft =>
  budget
    ? { ...budget, lines: budget.lines.map((l) => ({ ...l })) }
    : { contracting_entity: '', contractor: '', contract_value: null, start_date: '', lines: [{ id: 'R1', name: '', amount: null }] }

const nextLineId = (lines: { id: string }[]) => `R${Math.max(0, ...lines.map((l) => Number(l.id.replace(/\D/g, '')) || 0)) + 1}`

/** The checks the backend also runs, so most mistakes show before saving. */
function check(draft: Draft): FieldErrors {
  const errors: FieldErrors = {}
  if (!draft.contracting_entity.trim()) errors.contracting_entity = 'Escribe la entidad contratante.'
  if (!draft.contractor.trim()) errors.contractor = 'Escribe el contratista.'
  if (!draft.contract_value) errors.contract_value = 'Escribe el valor del contrato.'
  if (!draft.start_date) errors.start_date = 'Elige la fecha de inicio.'
  draft.lines.forEach((line, i) => {
    const name = line.name.trim()
    if (!name) errors[`lines[${i}].name`] = 'Ponle nombre al rubro.'
    else if (name.length > TRANSPARENCY_LIMITS.lineName) errors[`lines[${i}].name`] = `Máximo ${TRANSPARENCY_LIMITS.lineName} caracteres.`
  })
  return errors
}

const toInput = (draft: Draft): BudgetInput => ({
  contracting_entity: draft.contracting_entity.trim(),
  contractor: draft.contractor.trim(),
  contract_value: draft.contract_value ?? 0,
  start_date: draft.start_date,
  lines: draft.lines.map((l): BudgetLine => ({ id: l.id, name: l.name.trim(), amount: l.amount ?? 0 })),
})

/** The lines against the contract value: what's left is "sin asignar" (spec 017, US1, scenario 2). */
function Allocation({ value, assigned }: { value: number; assigned: number }) {
  const rest = value - assigned
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-inset px-4 py-3 text-label">
      <span className="tabular-nums">
        Rubros {cop(assigned)} de {cop(value)}
      </span>
      {rest > 0 && <span className="text-amber tabular-nums">Sin asignar {cop(rest)}</span>}
      {rest < 0 && <span className="text-coral tabular-nums">Los rubros pasan el valor por {cop(-rest)}</span>}
      {rest === 0 && value > 0 && <span className="text-teal">Todo asignado</span>}
    </p>
  )
}

function BudgetView({ budget }: { budget: Budget }) {
  return (
    <div className="grid gap-4">
      <PropertyRows>
        <Property icon={Flag02Icon} label="Contratante">{budget.contracting_entity}</Property>
        <Property icon={UserGroupIcon} label="Ejecutor">{budget.contractor}</Property>
        <Property icon={Coins01Icon} label="Valor"><span className="tabular-nums">{cop(budget.contract_value)}</span></Property>
        <Property icon={Calendar03Icon} label="Periodo">
          {formatLongDate(budget.start_date)} a {formatLongDate(budget.end_date)}
        </Property>
      </PropertyRows>
      <ul className="grid gap-1.5">
        {budget.lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-4 rounded-md bg-inset px-4 py-3">
            <span className="text-label">{line.name}</span>
            <span className="text-label tabular-nums text-ink-muted">{cop(line.amount)}</span>
          </li>
        ))}
      </ul>
      <Allocation value={budget.contract_value} assigned={budget.lines.reduce((s, l) => s + l.amount, 0)} />
    </div>
  )
}

interface BudgetEditorProps {
  budget: Budget | null
  /** The project's duration: the end date follows from it and isn't edited. */
  durationWeeks: number
  /** Leaders edit; members only read (spec 017, US1, scenario 3). */
  editable: boolean
  onSave: (body: BudgetInput) => Promise<FieldErrors>
  /** Starts in the form (no budget yet) instead of the summary. */
  startEditing?: boolean
}

export function BudgetEditor({ budget, durationWeeks, editable, onSave, startEditing = false }: BudgetEditorProps) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState<Draft>(() => toDraft(budget))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  if (!editing || !editable) {
    if (!budget) return null
    return (
      <div className="grid gap-4">
        <BudgetView budget={budget} />
        {editable && (
          <div>
            <Button icon={Edit02Icon} onClick={() => { setDraft(toDraft(budget)); setErrors({}); setEditing(true) }}>
              Editar presupuesto
            </Button>
          </div>
        )}
      </div>
    )
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setLine = (index: number, patch: Partial<Draft['lines'][number]>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))
  const assigned = draft.lines.reduce((s, l) => s + (l.amount ?? 0), 0)
  const end = endDateFor(draft.start_date, durationWeeks)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const local = check(draft)
    setErrors(local)
    if (Object.keys(local).length) return
    setSaving(true)
    const result = await onSave(toInput(draft))
    setSaving(false)
    setErrors(result)
    if (!Object.keys(result).length && budget) setEditing(false)
  }

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate aria-label="Presupuesto">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Entidad contratante" placeholder="Corpamag" value={draft.contracting_entity} error={errors.contracting_entity}
          onChange={(e) => set({ contracting_entity: e.target.value })} />
        <TextField label="Contratista (ejecutor)" placeholder="Fundación Manglares Vivos" value={draft.contractor} error={errors.contractor}
          onChange={(e) => set({ contractor: e.target.value })} />
        <NumberField label="Valor del contrato" unit="COP" value={formatAmountInput(draft.contract_value)} error={errors.contract_value}
          onChange={(e) => set({ contract_value: parseAmount(e.target.value) })} />
        <TextField label="Fecha de inicio" type="date" value={draft.start_date} error={errors.start_date}
          hint={end ? `Termina el ${formatLongDate(end)}, según la duración del proyecto (${durationWeeks} semanas).` : `Dura ${durationWeeks} semanas, como el proyecto.`}
          onChange={(e) => set({ start_date: e.target.value })} />
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-heading">Rubros</legend>
        <ul className="grid gap-2">
          {draft.lines.map((line, i) => (
            <li key={line.id} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-md bg-inset p-3 sm:grid-cols-[1fr_14rem_auto]">
              <TextField label={`Nombre del rubro ${line.id}`} hideLabel placeholder="Plántulas de mangle" size="md" fill="surface"
                value={line.name} error={errors[`lines[${i}].name`]} maxLength={TRANSPARENCY_LIMITS.lineName}
                onChange={(e) => setLine(i, { name: e.target.value })} />
              <NumberField label={`Monto del rubro ${line.id}`} hideLabel placeholder="0" unit="COP" size="md" fill="surface"
                className="order-3 col-span-2 sm:order-none sm:col-span-1"
                value={formatAmountInput(line.amount)} error={errors[`lines[${i}].amount`]}
                onChange={(e) => setLine(i, { amount: parseAmount(e.target.value) })} />
              <IconButton icon={Delete02Icon} label={`Quitar el rubro ${line.id}`} variant="quiet" disabled={draft.lines.length === 1}
                onClick={() => set({ lines: draft.lines.filter((_, j) => j !== i) })} />
            </li>
          ))}
        </ul>
        <div>
          <Button variant="quiet" icon={Add01Icon} onClick={() => set({ lines: [...draft.lines, { id: nextLineId(draft.lines), name: '', amount: null }] })}>
            Agregar rubro
          </Button>
        </div>
        <Allocation value={draft.contract_value ?? 0} assigned={assigned} />
        {errors[''] && <p className={cn('text-caption text-coral')}>{errors['']}</p>}
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2">
        {budget && <Button variant="quiet" onClick={() => setEditing(false)}>Cancelar</Button>}
        <Button type="submit" variant="primary" loading={saving}>Guardar presupuesto</Button>
      </div>
    </form>
  )
}
