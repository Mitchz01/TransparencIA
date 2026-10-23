import { useState } from 'react'
import { useTaskActions } from '../../../application/use-cases/useBoard'
import { PRIORITIES, type Priority, type Task, type TaskPatch, type TaskStatus } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { suggestsAdvance, type FieldErrors } from '../../../domain/rules'
import { Button, Drawer, NumberField, Pill, Select, StateLabel, TextArea, TextField } from '../ds'
import { ArrowRight01Icon, Tick02Icon, UserWarning01Icon } from '../ds/icons'
import { PRIORITY_LOOK, STATUS_LABELS, TYPE_LABELS } from './boardLabels'
import { Checklist } from './Checklist'

interface TaskDrawerProps {
  projectId: number
  task: Task
  members: Member[]
  columns: readonly TaskStatus[]
  onClose: () => void
}

interface Draft {
  title: string
  description: string
  points: string
  priority: Priority
  assignee: string // member id or ""
  status: TaskStatus
}

const draftOf = (task: Task): Draft => ({
  title: task.title,
  description: task.description,
  points: String(task.points),
  priority: task.priority,
  assignee: task.assignee_id === null ? '' : String(task.assignee_id),
  status: task.status,
})

/** Only what changed, as PATCH asks (contract, section 1). */
function patchOf(task: Task, draft: Draft): TaskPatch {
  const patch: TaskPatch = {}
  if (draft.title.trim() !== task.title) patch.title = draft.title.trim()
  if (draft.description !== task.description) patch.description = draft.description
  if (Number(draft.points) !== task.points) patch.points = draft.points.trim() === '' ? Number.NaN : Number(draft.points)
  if (draft.priority !== task.priority) patch.priority = draft.priority
  const assignee = draft.assignee === '' ? null : Number(draft.assignee)
  if (assignee !== task.assignee_id) patch.assignee_id = assignee
  if (draft.status !== task.status) patch.status = draft.status
  return patch
}

function validate(patch: TaskPatch): FieldErrors {
  const errors: FieldErrors = {}
  if (patch.title !== undefined && (!patch.title || patch.title.length > 200)) errors.title = 'Entre 1 y 200 caracteres.'
  if (patch.points !== undefined && (!Number.isInteger(patch.points) || patch.points < 0 || patch.points > 100)) errors.points = 'Entre 0 y 100.'
  return errors
}

/** Open a card: edit it, check its list, and move it without dragging. */
export function TaskDrawer({ projectId, task, members, columns, onClose }: TaskDrawerProps) {
  const { update, setChecklist } = useTaskActions(projectId)
  const [draft, setDraft] = useState(() => draftOf(task))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [suggest, setSuggest] = useState(suggestsAdvance(task))
  const priority = PRIORITY_LOOK[task.priority]
  const patch = patchOf(task, draft)
  const dirty = Object.keys(patch).length > 0

  const change = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }))
    setErrors({})
  }

  const save = async () => {
    const local = validate(patch)
    setErrors(local)
    if (Object.keys(local).length) return
    setSaving(true)
    const { errors: server, result } = await update(task.id, patch)
    setSaving(false)
    setErrors(server)
    if (result) {
      setDraft(draftOf(result.task))
      setSuggest(result.suggest_advance)
    }
  }

  const moveToReview = async () => {
    const { result } = await update(task.id, { status: 'review' })
    if (result) {
      setDraft(draftOf(result.task))
      setSuggest(false)
    }
  }

  return (
    <Drawer
      title={task.title}
      wide
      onClose={onClose}
      actions={
        <>
          <Button variant="primary" icon={Tick02Icon} loading={saving} disabled={!dirty} onClick={save}>Guardar cambios</Button>
        </>
      }
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-key text-ink-muted">{task.key}</span>
          <Pill hue="neutral">{task.epic_key}</Pill>
          <Pill hue="neutral">{TYPE_LABELS[task.type]}</Pill>
          <Pill hue={priority.hue}>{priority.label}</Pill>
        </div>

        {suggest && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
            <span className="flex items-center gap-2 text-label">El checklist está completo. ¿La pasas a revisión?</span>
            <Button size="sm" variant="primary" icon={ArrowRight01Icon} onClick={moveToReview}>Mover a revisión</Button>
          </div>
        )}

        {task.missing_role && (
          <div className="grid gap-1 rounded-md bg-amber-soft p-4">
            <StateLabel hue="amber" icon={UserWarning01Icon}>Falta {task.missing_role}</StateLabel>
            <p className="text-body text-ink">Nadie del equipo tiene ese rol. Asígnala a alguien para que avance.</p>
          </div>
        )}

        <TextField label="Título" value={draft.title} error={errors.title} onChange={(e) => change({ title: e.target.value })} />
        <TextArea label="Descripción" rows={3} value={draft.description} onChange={(e) => change({ description: e.target.value })} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select label="Estado" value={draft.status} options={columns.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} onChange={(e) => change({ status: e.target.value as TaskStatus })} />
          <Select
            label="Responsable"
            value={draft.assignee}
            options={[{ value: '', label: 'Sin asignar' }, ...members.map((m) => ({ value: String(m.id), label: `${m.name}, ${m.role}` }))]}
            onChange={(e) => change({ assignee: e.target.value })}
          />
          <Select label="Prioridad" value={draft.priority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LOOK[p].label }))} onChange={(e) => change({ priority: e.target.value as Priority })} />
          <NumberField label="Puntos" unit="pts" value={draft.points} error={errors.points} onChange={(e) => change({ points: e.target.value })} />
        </div>

        <Checklist
          items={task.checklist}
          onChange={async (items) => {
            const { result } = await setChecklist(task, items)
            if (result) setSuggest(result.suggest_advance)
          }}
        />

        {task.acceptance_criteria.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-label">Criterios de aceptación</h3>
            <ul className="grid gap-1.5">
              {task.acceptance_criteria.map((c) => (
                <li key={c} className="rounded-md bg-inset px-4 py-3 text-body">{c}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  )
}

