import { useState, type FormEvent } from 'react'
import type { MemberUpdate } from '../../../domain/account'
import { SENIORITIES, type Member, type Seniority } from '../../../domain/project'
import type { FieldErrors } from '../../../domain/rules'
import { SENIORITY_LABELS } from '../account/profileLabels'
import { Button, Dialog, FieldError, NumberField, Select, TextField } from '@agile/ui'
import { Tick02Icon } from '@agile/ui/icons'
import { SkillsField } from '../project/SkillsField'

/** A leader edits one member's data in this project; their profile doesn't change (spec 015, US6). */
export function MemberDialog({ member, onSave, onClose }: { member: Member; onSave: (update: MemberUpdate) => Promise<FieldErrors>; onClose: () => void }) {
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)
  const [seniority, setSeniority] = useState(member.seniority)
  const [hours, setHours] = useState(String(member.hours_per_week))
  const [skills, setSkills] = useState(member.skills)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const edited = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setErrors({})
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const hoursValue = hours.trim() === '' ? Number.NaN : Number(hours.trim())
    // Only what changed, as PATCH asks.
    const update: MemberUpdate = {
      ...(name.trim() !== member.name && { name }),
      ...(role.trim() !== member.role && { role }),
      ...(seniority !== member.seniority && { seniority }),
      ...(hoursValue !== member.hours_per_week && { hours_per_week: hoursValue }),
      ...(JSON.stringify(skills) !== JSON.stringify(member.skills) && { skills }),
    }
    if (Object.keys(update).length === 0) return onClose()
    setSaving(true)
    const result = await onSave(update)
    setSaving(false)
    if (Object.keys(result).length) setErrors(result)
    else onClose()
  }

  const skillErrors = Object.fromEntries(
    Object.entries(errors).flatMap(([field, message]) => {
      const match = /^skills\[(\d+)\]$/.exec(field)
      return match ? [[Number(match[1]), message]] : []
    }),
  )

  return (
    <Dialog title={`Editar a ${member.name}`} description="Solo en este proyecto. Su perfil no cambia." onClose={onClose}>
      <form noValidate onSubmit={submit} className="grid gap-5">
        {errors[''] && <FieldError>{errors['']}</FieldError>}
        <TextField label="Nombre" size="md" value={name} error={errors.name} onChange={(e) => edited(setName)(e.target.value)} />
        <TextField label="Rol" size="md" value={role} error={errors.role} onChange={(e) => edited(setRole)(e.target.value)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Seniority"
            size="md"
            value={seniority}
            options={SENIORITIES.map((s) => ({ value: s, label: SENIORITY_LABELS[s] }))}
            onChange={(e) => edited(setSeniority)(e.target.value as Seniority)}
          />
          <NumberField label="Horas por semana" size="md" unit="h" value={hours} error={errors.hours_per_week} onChange={(e) => edited(setHours)(e.target.value)} />
        </div>
        <SkillsField label="Habilidades" fill="inset" skills={skills} errors={skillErrors} onChange={edited(setSkills)} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={Tick02Icon} loading={saving}>Guardar</Button>
        </div>
      </form>
    </Dialog>
  )
}
