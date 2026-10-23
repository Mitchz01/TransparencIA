import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { REQUESTED_METHODOLOGIES, type RequestedMethodology } from '../../../domain/project'
import { validateProject, type FieldErrors } from '../../../domain/rules'
import { Button, Card, FieldError, NumberField, Segmented, Select, TextArea, TextField, type IconGlyph } from '../ds'
import { MemberRows } from './MemberRows'
import { toProjectCreate, type ProjectDraft } from './projectDraft'

export const METHODOLOGY_LABELS: Record<RequestedMethodology, string> = {
  auto: 'Que elijan los agentes',
  scrum: 'Scrum',
  kanban: 'Kanban',
  scrumban: 'Scrumban',
  xp: 'XP',
  shape_up: 'Shape Up',
}

interface ProjectFormProps {
  initial: ProjectDraft
  submitLabel: string
  submitIcon?: IconGlyph
  /** Returns the service's field errors, if any. */
  onSubmit: (draft: ProjectDraft) => Promise<FieldErrors | void>
  secondaryAction?: ReactNode
  /** Why the methodology can't change (planning already started). */
  methodologyLocked?: string
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card padding="lg" className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <div className="grid gap-1">
        <h2 className="text-heading">{title}</h2>
        <p className="text-body text-ink-muted">{description}</p>
      </div>
      {children}
    </Card>
  )
}

/** The project and its team. Checks the service's rules before sending and keeps what was typed (FR-008). */
export function ProjectForm({ initial, submitLabel, submitIcon, onSubmit, secondaryAction, methodologyLocked }: ProjectFormProps) {
  const [draft, setDraft] = useState(initial)
  const [checked, setChecked] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  const errors: FieldErrors = { ...(checked ? validateProject(toProjectCreate(draft)) : {}), ...serverErrors }

  // After a failed send, take the person to the first field that needs fixing.
  useEffect(() => {
    if (attempt) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [attempt])

  const change = (patch: Partial<ProjectDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setServerErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setChecked(true)
    if (Object.keys(validateProject(toProjectCreate(draft))).length) {
      setAttempt((n) => n + 1)
      return
    }
    setSending(true)
    try {
      const fieldErrors = await onSubmit(draft)
      if (fieldErrors && Object.keys(fieldErrors).length) {
        setServerErrors(fieldErrors)
        setAttempt((n) => n + 1)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <form ref={form} noValidate onSubmit={submit} className="grid min-w-0 gap-3 [&>*]:min-w-0">
      {errors[''] && <FieldError>{errors['']}</FieldError>}
      <Section title="Proyecto" description="Qué quieres construir, para quién y todo lo que los agentes deban saber.">
        <TextField label="Nombre del proyecto" value={draft.name} error={errors.name} placeholder="Tienda online" onChange={(e) => change({ name: e.target.value })} />
        <TextArea
          label="Descripción"
          rows={5}
          value={draft.description}
          error={errors.description}
          placeholder="Una tienda de muebles artesanales, con catálogo, carrito y pagos."
          onChange={(e) => change({ description: e.target.value })}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField label="Duración" unit="semanas" value={draft.duration} error={errors.duration_weeks} hint="Entre 1 y 52." onChange={(e) => change({ duration: e.target.value })} />
          <Select
            label="Metodología"
            value={draft.methodology}
            disabled={Boolean(methodologyLocked)}
            hint={methodologyLocked}
            error={errors.requested_methodology}
            options={REQUESTED_METHODOLOGIES.map((m) => ({ value: m, label: METHODOLOGY_LABELS[m] }))}
            onChange={(e) => change({ methodology: e.target.value as RequestedMethodology })}
          />
        </div>
      </Section>

      <Section title="Equipo" description="Quién trabaja y cuántas horas por semana. Los agentes planifican a partir de eso.">
        <MemberRows members={draft.members} errors={errors} onChange={(members) => change({ members })} />
      </Section>

      <Section title="Aprobación automática" description="Activada: cada propuesta se aprueba al llegar y sigue mostrando por qué. Desactivada: cada etapa espera tu decisión.">
        <div>
          <Segmented
            label="Aprobación automática"
            inset
            value={draft.autoApprove ? 'on' : 'off'}
            onChange={(v) => change({ autoApprove: v === 'on' })}
            options={[{ value: 'off', label: 'Desactivada' }, { value: 'on', label: 'Activada' }]}
          />
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
        {secondaryAction}
        <Button type="submit" variant="primary" size="lg" icon={submitIcon} loading={sending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
