import { useState } from 'react'
import { useTaskActions } from '../../../application/use-cases/useBoard'
import { PRIORITIES, TASK_LIMITS, type ChecklistItem, type Task, type TaskPatch, type TaskStatus } from '../../../domain/board'
import type { Member } from '../../../domain/project'
import { suggestsAdvance, type FieldErrors } from '../../../domain/rules'
import { Avatar, Button, Drawer, InlineText, Menu, Pill, Property, PropertyRows, StateLabel } from '../ds'
import {
  ArrowRight01Icon, CheckListIcon, Flag02Icon, GithubIcon, Loading03Icon, Target02Icon, Tick02Icon, UserIcon, UserWarning01Icon,
} from '../ds/icons'
import { IssueBadge } from '../integrations/IssueBadge'
import { PRIORITY_LOOK, STATUS_LABELS, TYPE_LABELS } from './boardLabels'
import { Checklist } from './Checklist'

interface TaskDrawerProps {
  projectId: number
  task: Task
  members: Member[]
  columns: readonly TaskStatus[]
  onClose: () => void
}

const [MIN_POINTS, MAX_POINTS] = TASK_LIMITS.points

/** "Guardando" while any change is on its way, "Guardado" once the last one landed (spec 011, FR-007). */
function SaveState({ pending, saved }: { pending: number; saved: boolean }) {
  if (pending > 0) return <StateLabel hue="neutral" icon={Loading03Icon} spin>Guardando</StateLabel>
  if (saved) return <StateLabel hue="neutral" icon={Tick02Icon}>Guardado</StateLabel>
  return null
}

/** Open a card: read it like a page and change each value where it is. Every change saves itself (spec 011). */
export function TaskDrawer({ projectId, task, members, columns, onClose }: TaskDrawerProps) {
  const { update, setChecklist } = useTaskActions(projectId)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(0)
  const [saved, setSaved] = useState(false)
  const [suggest, setSuggest] = useState(suggestsAdvance(task))
  const priority = PRIORITY_LOOK[task.priority]
  const assignee = members.find((m) => m.id === task.assignee_id)

  const track = async (call: () => Promise<{ errors: FieldErrors; result?: { suggest_advance: boolean } }>, fields: string[]) => {
    setPending((n) => n + 1)
    setSaved(false)
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field))))
    const { errors: server, result } = await call()
    setPending((n) => n - 1)
    setErrors((current) => ({ ...current, ...server }))
    if (result) {
      setSuggest(result.suggest_advance)
      setSaved(true)
    }
  }

  const save = (patch: TaskPatch) => track(() => update(task.id, patch), Object.keys(patch))

  const saveChecklist = (items: ChecklistItem[]) => track(() => setChecklist(task, items), ['items'])

  const commitTitle = (text: string) => {
    const title = text.replace(/\s*\n\s*/g, ' ').trim()
    if (!title || title.length > TASK_LIMITS.title) return `Entre 1 y ${TASK_LIMITS.title} caracteres.`
    if (title !== task.title) void save({ title })
  }

  const commitPoints = (text: string) => {
    const points = Number(text.trim())
    if (!/^\d+$/.test(text.trim()) || points < MIN_POINTS || points > MAX_POINTS) return `Entre ${MIN_POINTS} y ${MAX_POINTS}.`
    if (points !== task.points) void save({ points })
  }

  const commitDescription = (description: string) => {
    if (description !== task.description) void save({ description })
  }

  const header = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <span className="text-key text-ink-muted">{task.key}</span>
      <Pill hue="neutral">{task.epic_key}</Pill>
      <Pill hue="neutral">{TYPE_LABELS[task.type]}</Pill>
      <span className="ml-auto">
        <SaveState pending={pending} saved={saved} />
      </span>
    </div>
  )

  return (
    <Drawer title={task.title} header={header} wide onClose={onClose}>
      <div className="grid gap-6">
        <InlineText label="Título" value={task.title} error={errors.title} onCommit={commitTitle} wrap className="-mx-3 text-heading" />

        {suggest && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
            <span className="flex items-center gap-2 text-label">El checklist está completo. ¿La pasas a revisión?</span>
            <Button size="sm" variant="primary" icon={ArrowRight01Icon} onClick={() => void save({ status: 'review' })}>Mover a revisión</Button>
          </div>
        )}

        <PropertyRows>
          <Property label="Estado" icon={CheckListIcon}>
            <Menu
              label={`Estado: ${STATUS_LABELS[task.status]}`}
              variant="quiet"
              className="-ml-5"
              items={columns.map((status) => ({
                key: status,
                label: STATUS_LABELS[status],
                selected: status === task.status,
                onSelect: () => status !== task.status && void save({ status }),
              }))}
            >
              <span className="text-ink">{STATUS_LABELS[task.status]}</span>
            </Menu>
          </Property>

          <Property label="Responsable" icon={UserIcon}>
            <Menu
              label={`Responsable: ${assignee ? assignee.name : task.missing_role ? `falta ${task.missing_role}` : 'sin asignar'}`}
              variant="quiet"
              className="-ml-5"
              items={[
                { key: 'none', label: 'Sin asignar', selected: task.assignee_id === null, onSelect: () => task.assignee_id !== null && void save({ assignee_id: null }) },
                ...members.map((m) => ({
                  key: String(m.id),
                  label: m.name,
                  caption: m.role,
                  selected: m.id === task.assignee_id,
                  onSelect: () => m.id !== task.assignee_id && void save({ assignee_id: m.id }),
                })),
              ]}
            >
              {assignee ? (
                <span className="flex items-center gap-2 text-ink">
                  <Avatar name={assignee.name} />
                  {assignee.name}
                </span>
              ) : task.missing_role ? (
                <StateLabel hue="amber" icon={UserWarning01Icon}>Falta {task.missing_role}</StateLabel>
              ) : (
                'Sin asignar'
              )}
            </Menu>
          </Property>

          <Property label="Prioridad" icon={Flag02Icon}>
            <Menu
              label={`Prioridad: ${priority.label}`}
              variant="quiet"
              className="-ml-5"
              items={PRIORITIES.map((p) => ({
                key: p,
                label: PRIORITY_LOOK[p].label,
                selected: p === task.priority,
                onSelect: () => p !== task.priority && void save({ priority: p }),
              }))}
            >
              <StateLabel hue={priority.hue} icon={Flag02Icon}>{priority.label}</StateLabel>
            </Menu>
          </Property>

          <Property label="Puntos" icon={Target02Icon}>
            <InlineText label="Puntos" value={String(task.points)} error={errors.points} onCommit={commitPoints} unit="pts" inputMode="numeric" className="-ml-3" />
          </Property>

          {task.issue && (
            <Property label="Issue" icon={GithubIcon}>
              <span className="text-label">
                <IssueBadge issue={task.issue} />
              </span>
            </Property>
          )}
        </PropertyRows>

        <section className="grid gap-1">
          <h3 className="text-label">Descripción</h3>
          <InlineText
            label="Descripción"
            value={task.description}
            error={errors.description}
            onCommit={commitDescription}
            multiline
            placeholder="Agrega una descripción"
            className="-mx-3 text-body"
          />
        </section>

        <Checklist items={task.checklist} onChange={(items) => void saveChecklist(items)} />

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
