import { SENIORITIES, type Seniority } from '../../../domain/project'
import type { FieldErrors } from '../../../domain/rules'
import { Button, FieldError, IconButton, NumberField, Select, TextField } from '../ds'
import { Delete02Icon, UserAdd01Icon } from '../ds/icons'
import { newMember, type MemberDraft } from './projectDraft'
import { SkillsField } from './SkillsField'

const SENIORITY_LABELS: Record<Seniority, string> = { junior: 'Junior', mid: 'Semisenior', senior: 'Senior' }

interface MemberRowsProps {
  members: MemberDraft[]
  onChange: (members: MemberDraft[]) => void
  errors: FieldErrors
}

/** The team, one block per member. New rows come with the service's defaults (mid, 20 hours). */
export function MemberRows({ members, onChange, errors }: MemberRowsProps) {
  const update = (key: string, change: Partial<MemberDraft>) => onChange(members.map((m) => (m.key === key ? { ...m, ...change } : m)))

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3 [&>*]:min-w-0" aria-label="Miembros del equipo">
        {members.map((member, i) => {
          const path = `members[${i}]`
          const name = member.name.trim() || `miembro ${i + 1}`
          const skillErrors = Object.fromEntries(
            Object.entries(errors).flatMap(([field, message]) => {
              const match = field.match(new RegExp(`^members\\[${i}\\]\\.skills\\[(\\d+)\\]$`))
              return match ? [[Number(match[1]), message]] : []
            }),
          )
          return (
            <li key={member.key} className="grid gap-4 rounded-md bg-inset p-4 sm:p-5 [&>*]:min-w-0">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)] [&>*]:min-w-0">
                <TextField label="Nombre" size="md" fill="surface" value={member.name} error={errors[`${path}.name`]} autoComplete="off" onChange={(e) => update(member.key, { name: e.target.value })} />
                <TextField label="Rol" size="md" fill="surface" value={member.role} placeholder="Frontend" error={errors[`${path}.role`]} onChange={(e) => update(member.key, { role: e.target.value })} />
                <Select
                  label="Seniority"
                  size="md"
                  fill="surface"
                  value={member.seniority}
                  error={errors[`${path}.seniority`]}
                  options={SENIORITIES.map((s) => ({ value: s, label: SENIORITY_LABELS[s] }))}
                  onChange={(e) => update(member.key, { seniority: e.target.value as Seniority })}
                />
                <NumberField label="Horas por semana" size="md" fill="surface" unit="h" value={member.hours} error={errors[`${path}.hours_per_week`]} onChange={(e) => update(member.key, { hours: e.target.value })} />
              </div>
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <SkillsField label="Habilidades" skills={member.skills} errors={skillErrors} onChange={(skills) => update(member.key, { skills })} />
                </div>
                <IconButton
                  icon={Delete02Icon}
                  label={`Quitar a ${name}`}
                  variant="quiet"
                  tooltip="above"
                  tooltipAlign="end"
                  onClick={() => onChange(members.filter((m) => m.key !== member.key))}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {errors.members && <FieldError>{errors.members}</FieldError>}
      <div>
        <Button icon={UserAdd01Icon} onClick={() => onChange([...members, newMember()])}>
          Agregar miembro
        </Button>
      </div>
    </div>
  )
}
