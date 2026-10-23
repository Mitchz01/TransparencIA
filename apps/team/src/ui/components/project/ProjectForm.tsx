import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { validateProject, type FieldErrors } from '../../../domain/rules'
import { Button, Card, FieldError, Icon, NumberField, Segmented, TextArea, TextField, type IconGlyph } from '@agile/ui'
import { Link01Icon } from '@agile/ui/icons'
import { toProjectCreate, type ProjectDraft, type RoleField } from './projectDraft'

interface ProjectFormProps {
  initial: ProjectDraft
  submitLabel: string
  submitIcon?: IconGlyph
  /** Returns the service's field errors, if any. */
  onSubmit: (draft: ProjectDraft) => Promise<FieldErrors | void>
  secondaryAction?: ReactNode
  /** A new project asks for your role in it (spec 015); settings leave it out. */
  roleField?: RoleField
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

/** The project and your part in it. Checks the service's rules before sending and keeps what was typed (FR-008).
 *  No methodology field: every project runs by stages (spec 019, D3); the draft keeps sending it. */
export function ProjectForm({ initial, submitLabel, submitIcon, onSubmit, secondaryAction, roleField }: ProjectFormProps) {
  const [draft, setDraft] = useState(initial)
  const [checked, setChecked] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  const errors: FieldErrors = { ...(checked ? validateProject(toProjectCreate(draft, roleField)) : {}), ...serverErrors }

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
    if (Object.keys(validateProject(toProjectCreate(draft, roleField))).length) {
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
      <Section title="Proyecto" description="Qué se va a ejecutar, dónde, para quién y todo lo que los agentes deban saber: la entidad, el valor, las metas.">
        <TextField label="Nombre del proyecto" value={draft.name} error={errors.name} placeholder="Restauración de manglar en la Ciénaga Grande" onChange={(e) => change({ name: e.target.value })} />
        <TextArea
          label="Descripción"
          rows={5}
          value={draft.description}
          error={errors.description}
          placeholder="Restaurar 5 hectáreas de manglar con la comunidad: vivero, siembra, mantenimiento y monitoreo. Contrato con Corpamag por $180.000.000."
          onChange={(e) => change({ description: e.target.value })}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            label="Duración"
            unit="semanas"
            value={draft.duration}
            error={errors.duration_weeks}
            hint="Entre 1 y 52. Seis meses son 26 semanas."
            onChange={(e) => change({ duration: e.target.value })}
          />
        </div>
      </Section>

      {roleField && (
        <Section title="Tu parte" description="Entras como líder del proyecto. Los agentes también te asignan actividades.">
          <TextField
            label="Tu cargo en este proyecto"
            value={draft.role}
            error={errors.role}
            placeholder="Coordinadora del proyecto"
            hint={roleField === 'optional' ? 'Viene de tu perfil. Cámbialo si aquí haces otra cosa.' : 'Tu perfil todavía no tiene cargo: dinos qué vas a hacer aquí.'}
            onChange={(e) => change({ role: e.target.value })}
          />
          <p className="flex items-start gap-3 rounded-md bg-inset p-4 text-body text-ink-muted">
            <Icon icon={Link01Icon} className="mt-0.5 shrink-0 text-ink" />
            Tu equipo se une con un link que compartes al crear el proyecto. Cada persona llega con su perfil.
          </p>
        </Section>
      )}

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
