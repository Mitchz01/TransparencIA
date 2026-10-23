import { useState, type FormEvent } from 'react'
import type { MemberUpdate } from '../../../domain/account'
import type { Member } from '../../../domain/project'
import type { FieldErrors } from '../../../domain/rules'
import { Button, Dialog, FieldError, NumberField, TextField } from '@agile/ui'
import { Tick02Icon } from '@agile/ui/icons'

/** A leader edits one member's data in this project; their profile doesn't change (spec 015, US6).
 *  Spec 020: only the name, the position (cargo) and the dedication; seniority and skills stay as they are. */
export function MemberDialog({ member, onSave, onClose }: { member: Member; onSave: (update: MemberUpdate) => Promise<FieldErrors>; onClose: () => void }) {
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)
  const [hours, setHours] = useState(String(member.hours_per_week))
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
      ...(hoursValue !== member.hours_per_week && { hours_per_week: hoursValue }),
    }
    if (Object.keys(update).length === 0) return onClose()
    setSaving(true)
    const result = await onSave(update)
    setSaving(false)
    if (Object.keys(result).length) setErrors(result)
    else onClose()
  }

  return (
    <Dialog title={`Editar a ${member.name}`} description="Solo en este proyecto. Su perfil no cambia." onClose={onClose}>
      <form noValidate onSubmit={submit} className="grid gap-5">
        {errors[''] && <FieldError>{errors['']}</FieldError>}
        <TextField label="Nombre" size="md" value={name} error={errors.name} onChange={(e) => edited(setName)(e.target.value)} />
        <TextField label="Cargo" size="md" value={role} error={errors.role} onChange={(e) => edited(setRole)(e.target.value)} />
        <NumberField label="Dedicación (horas por semana)" size="md" unit="h" value={hours} error={errors.hours_per_week} hint="Los agentes reparten las actividades según este tiempo." onChange={(e) => edited(setHours)(e.target.value)} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={Tick02Icon} loading={saving}>Guardar</Button>
        </div>
      </form>
    </Dialog>
  )
}
