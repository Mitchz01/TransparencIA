import { useState, type FormEvent, type ReactNode } from 'react'
import type { Account, ProfileUpdate } from '../../../domain/account'
import { SENIORITIES, type Seniority } from '../../../domain/project'
import type { FieldErrors } from '../../../domain/rules'
import { Button, Card, Chip, FieldError, NumberField, Segmented, TextField, type IconGlyph } from '../ds'
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

/** What the profile looks like with the edits so far: the profile page shows it while you type. */
export type ProfilePreview = Pick<Account, 'name' | 'role' | 'seniority' | 'hours_per_week' | 'skills' | 'github_username' | 'avatar_url'>

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

const roleOf = (draft: ProfileDraft) => (draft.choice === OTHER ? draft.other.trim() || null : draft.choice)

/** "" or "abc" hours become NaN, which the rules reject. */
const hoursOf = (draft: ProfileDraft) => (draft.hours.trim() === '' ? Number.NaN : Number(draft.hours.trim()))

/** While typing, a half-written field keeps the saved value instead of showing nonsense. */
function previewOf(account: Account, draft: ProfileDraft): ProfilePreview {
  const hours = hoursOf(draft)
  return {
    name: draft.name.trim() || account.name,
    role: roleOf(draft),
    seniority: draft.seniority,
    hours_per_week: Number.isInteger(hours) && hours > 0 ? hours : account.hours_per_week,
    skills: draft.skills,
    github_username: draft.github.trim().replace(/^@/, '') || null,
    avatar_url: account.avatar_url,
  }
}

/** Only what changed, as PATCH asks. */
function toUpdate(account: Account, draft: ProfileDraft, withName: boolean): ProfileUpdate {
  const role = roleOf(draft)
  const hours = hoursOf(draft)
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
  /** `plain`: one column of fields (the step after sign up). `sections`: the fields grouped in cards (the profile page). */
  layout?: 'plain' | 'sections'
  submitLabel: string
  submitIcon?: IconGlyph
  /** Resolves with the field errors to show; an empty update isn't sent. */
  onSubmit: (update: ProfileUpdate) => Promise<FieldErrors>
  /** Called after saving (or when there was nothing to save). */
  onDone: () => void
  /** Called on every edit with the profile as it would look saved. */
  onPreview?: (preview: ProfilePreview) => void
  secondaryAction?: ReactNode
}

interface SectionProps {
  /** Off in the plain layout: the fields go straight into the form. */
  card: boolean
  title: string
  description?: string
  children: ReactNode
}

/** A group of fields on a card, with a heading and, when it needs one, a sentence that says what it's for. */
function Section({ card, title, description, children }: SectionProps) {
  if (!card) return children
  return (
    <Card padding="lg" className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-heading">{title}</h2>
        {description && <p className="text-body text-ink-muted">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

/** What you bring to every project you join (spec 015, FR-005). Every field has a default. */
export function ProfileForm({
  account, withName = false, layout = 'plain', submitLabel, submitIcon, onSubmit, onDone, onPreview, secondaryAction,
}: ProfileFormProps) {
  const [draft, setDraft] = useState(() => draftFrom(account))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const sections = layout === 'sections'
  // Inside a card the fields sit on `inset`; on the page they sit on `surface`.
  const fill = sections ? 'inset' : 'surface'

  const change = (patch: Partial<ProfileDraft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    setErrors({})
    onPreview?.(previewOf(account, next))
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

  const nameField = withName && (
    <TextField label="Nombre" fill={fill} autoComplete="name" value={draft.name} error={errors.name} hint="Cambiarlo te renombra en todos tus proyectos." onChange={(e) => change({ name: e.target.value })} />
  )

  const githubField = (
    <TextField
      label="Usuario de GitHub"
      fill={fill}
      hint="Opcional. Sirve para asignarte issues."
      placeholder="usuario"
      autoComplete="off"
      value={draft.github}
      error={errors.github_username}
      onChange={(e) => change({ github: e.target.value })}
    />
  )

  return (
    <form noValidate onSubmit={submit} className={sections ? 'grid gap-3' : 'grid gap-6'}>
      {errors[''] && <FieldError>{errors['']}</FieldError>}
      <Section card={sections} title="Mi información">
        {nameField}
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-label">{sections ? 'Rol' : 'Qué haces'}</legend>
          <div role="group" aria-label="Rol" className="flex flex-wrap gap-2">
            {[...COMMON_ROLES, OTHER].map((role) => (
              <Chip key={role} inset={sections} pressed={draft.choice === role} onClick={() => change({ choice: draft.choice === role ? null : role })}>
                {role}
              </Chip>
            ))}
          </div>
          {draft.choice === OTHER && (
            <TextField label="Tu rol" hideLabel fill={fill} placeholder="Data, mobile, QA manual" autoFocus value={draft.other} error={errors.role} onChange={(e) => change({ other: e.target.value })} />
          )}
          {draft.choice !== OTHER && errors.role && <FieldError>{errors.role}</FieldError>}
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="grid gap-2">
            <span className="text-label">Seniority</span>
            <Segmented
              label="Seniority"
              inset={sections}
              value={draft.seniority}
              options={SENIORITIES.map((s) => ({ value: s, label: SENIORITY_LABELS[s] }))}
              onChange={(seniority) => change({ seniority })}
            />
          </div>
          <NumberField label="Horas por semana" fill={fill} unit="h" value={draft.hours} error={errors.hours_per_week} hint="Entre 1 y 60." onChange={(e) => change({ hours: e.target.value })} />
        </div>

        <SkillsField label="Habilidades" fill={fill} skills={draft.skills} errors={skillErrors} onChange={(skills) => change({ skills })} />
      </Section>

      {/* Apart: later each person connects their own GitHub account here instead of typing it. */}
      <Section card={sections} title="GitHub" description="Por ahora escribe tu usuario. Más adelante podrás conectar tu cuenta.">
        {githubField}
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {secondaryAction}
        <Button type="submit" variant="primary" size="lg" icon={submitIcon} loading={sending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
