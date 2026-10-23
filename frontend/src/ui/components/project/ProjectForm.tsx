import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { REQUESTED_METHODOLOGIES, type RequestedMethodology } from '../../../domain/project'
import { validateProject, type FieldErrors } from '../../../domain/rules'
import { Button, Card, FieldError, NumberField, Segmented, Select, TextArea, TextField, type IconGlyph } from '../ds'
import { MemberRows } from './MemberRows'
import { toProjectCreate, type ProjectDraft } from './projectDraft'

export const METHODOLOGY_LABELS: Record<RequestedMethodology, string> = {
  auto: 'Let the agents choose',
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
    <Card padding="lg" className="grid gap-5">
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
    <form ref={form} noValidate onSubmit={submit} className="grid gap-3">
      {errors[''] && <FieldError>{errors['']}</FieldError>}
      <Section title="Project" description="What you want to build, for whom, and anything the agents should know.">
        <TextField label="Project name" value={draft.name} error={errors.name} placeholder="Online store" onChange={(e) => change({ name: e.target.value })} />
        <TextArea
          label="Description"
          rows={5}
          value={draft.description}
          error={errors.description}
          placeholder="A store for handmade furniture, with a catalog, a cart and payments."
          onChange={(e) => change({ description: e.target.value })}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField label="Duration" unit="weeks" value={draft.duration} error={errors.duration_weeks} hint="Between 1 and 52." onChange={(e) => change({ duration: e.target.value })} />
          <Select
            label="Methodology"
            value={draft.methodology}
            disabled={Boolean(methodologyLocked)}
            hint={methodologyLocked}
            error={errors.requested_methodology}
            options={REQUESTED_METHODOLOGIES.map((m) => ({ value: m, label: METHODOLOGY_LABELS[m] }))}
            onChange={(e) => change({ methodology: e.target.value as RequestedMethodology })}
          />
        </div>
      </Section>

      <Section title="Team" description="Who works on it and how many hours a week. The agents plan around them.">
        <MemberRows members={draft.members} errors={errors} onChange={(members) => change({ members })} />
      </Section>

      <Section title="Auto-approve" description="On: each proposal is approved as it arrives, and still shows why. Off: every stage waits for you.">
        <div>
          <Segmented
            label="Auto-approve"
            inset
            value={draft.autoApprove ? 'on' : 'off'}
            onChange={(v) => change({ autoApprove: v === 'on' })}
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
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
