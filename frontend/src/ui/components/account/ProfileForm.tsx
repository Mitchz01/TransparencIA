import { useState, type FormEvent, type ReactNode } from 'react'
import type { Account, ProfileUpdate } from '../../../domain/account'
import { SENIORITIES, type Seniority } from '../../../domain/project'
import type { FieldErrors } from '../../../domain/rules'
import { Button, Chip, FieldError, NumberField, Segmented, TextField, type IconGlyph } from '../ds'
import { SkillsField } from '../project/SkillsField'
import { COMMON_ROLES, SENIORITY_LABELS } from './profileLabels'

const OTHER = 'Otro'

interface ProfileDraft {
  name: string
  choice: string | null // one of COMMON_ROLES, OTHER, or none
  other: string
  seniority: Seniority
  hours: string
  skills: string[]
  github: string
}

const draftFrom = (account: Account): ProfileDraft => {
  const common = COMMON_ROLES.find((r) => r.toLowerCase() === account.role?.toLowerCase())
  return {
    name: account.name,
    choice: common ?? (account.role ? OTHER : null),
    other: common ? '' : account.role ?? '',
    seniority: account.seniority,
    hours: String(account.hours_per_week),
    skills: account.skills,
    github: account.github_username ?? '',
  }
}

/** Only what changed, as PATCH asks. "" or "abc" hours become NaN, which the rules reject. */
function toUpdate(account: Account, draft: ProfileDraft, withName: boolean): ProfileUpdate {
  const role = draft.choice === OTHER ? draft.other.trim() || null : draft.choice
  const hours = draft.hours.trim() === '' ? Number.NaN : Number(draft.hours.trim())
  const github = draft.github.trim() || null
  const update: ProfileUpdate = {}
  if (withName && draft.name.trim() !== account.name) update.name = draft.name
  if (role !== account.role) update.role = role
  if (draft.seniority !== account.seniority) update.seniority = draft.seniority
  if (hours !== account.hours_per_week) update.hours_per_week = hours
  if (JSON.stringify(draft.skills) !== JSON.stringify(account.skills)) update.skills = draft.skills
  if (github !== account.github_username) update.github_username = github
  return update
}

interface ProfileFormProps {
  account: Account
  /** The full profile edits the name too; the step after sign up already has it. */
  withName?: boolean
  submitLabel: string
  submitIcon?: IconGlyph
  /** Resolves with the field errors to show; an empty update isn't sent. */
  onSubmit: (update: ProfileUpdate) => Promise<FieldErrors>
  /** Called after saving (or when there was nothing to save). */
  onDone: () => void
  secondaryAction?: ReactNode
}

/** What you bring to every project you join (spec 015, FR-005). Every field has a default. */
export function ProfileForm({ account, withName = false, submitLabel, submitIcon, onSubmit, onDone, secondaryAction }: ProfileFormProps) {
  const [draft, setDraft] = useState(() => draftFrom(account))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)

  const change = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const update = toUpdate(account, draft, withName)
    if (Object.keys(update).length === 0) return onDone()
    setSending(true)
    const result = await onSubmit(update)
    setSending(false)
    setErrors(result)
    if (Object.keys(result).length === 0) onDone()
  }

  const skillErrors = Object.fromEntries(
    Object.entries(errors).flatMap(([field, message]) => {
      const match = /^skills\[(\d+)\]$/.exec(field)
      return match ? [[Number(match[1]), message]] : []
    }),
  )

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      {errors[''] && <FieldError>{errors['']}</FieldError>}
      {withName && (
        <TextField label="Nombre" fill="surface" autoComplete="name" value={draft.name} error={errors.name} hint="Cambiarlo te renombra en todos tus proyectos." onChange={(e) => change({ name: e.target.value })} />
      )}

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-label">Qué haces</legend>
        <div role="group" aria-label="Rol" className="flex flex-wrap gap-2">
          {[...COMMON_ROLES, OTHER].map((role) => (
            <Chip key={role} pressed={draft.choice === role} onClick={() => change({ choice: draft.choice === role ? null : role })}>
              {role}
            </Chip>
          ))}
        </div>
        {draft.choice === OTHER && (
          <TextField label="Tu rol" hideLabel fill="surface" placeholder="Data, mobile, QA manual" autoFocus value={draft.other} error={errors.role} onChange={(e) => change({ other: e.target.value })} />
        )}
        {draft.choice !== OTHER && errors.role && <FieldError>{errors.role}</FieldError>}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <div className="grid gap-2">
          <span className="text-label">Seniority</span>
          <Segmented
            label="Seniority"
            value={draft.seniority}
            options={SENIORITIES.map((s) => ({ value: s, label: SENIORITY_LABELS[s] }))}
            onChange={(seniority) => change({ seniority })}
          />
        </div>
        <NumberField label="Horas por semana" fill="surface" unit="h" value={draft.hours} error={errors.hours_per_week} hint="Entre 1 y 60." onChange={(e) => change({ hours: e.target.value })} />
      </div>

      <SkillsField label="Habilidades" skills={draft.skills} errors={skillErrors} onChange={(skills) => change({ skills })} />

      <TextField
        label="Usuario de GitHub"
        fill="surface"
        hint="Opcional. Sirve para asignarte issues."
        placeholder="usuario"
        autoComplete="off"
        value={draft.github}
        error={errors.github_username}
        onChange={(e) => change({ github: e.target.value })}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {secondaryAction}
        <Button type="submit" variant="primary" size="lg" icon={submitIcon} loading={sending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
