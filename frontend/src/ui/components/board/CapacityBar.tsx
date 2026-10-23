import { useState, type FormEvent } from 'react'
import { useCapacity } from '../../../application/use-cases/useBoard'
import type { SprintLoad } from '../../../domain/board'
import { Button, Dialog, IconButton, NumberField, ProgressTrack, StateLabel } from '../ds'
import { Alert02Icon, Edit02Icon } from '../ds/icons'

interface CapacityBarProps {
  projectId: number
  load: SprintLoad
  override: number | null
}

/** The sprint's points against what the team can do. Going over warns, never blocks. */
export function CapacityBar({ projectId, load, override }: CapacityBarProps) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex min-h-control-md flex-wrap items-center gap-x-3 gap-y-2 rounded-pill bg-surface py-1 pr-1 pl-5">
      <span className="text-label tabular-nums whitespace-nowrap">{load.points} de {load.capacity} pts</span>
      <ProgressTrack value={load.points} max={load.capacity} over={load.overloaded} label={`Carga del sprint: ${load.points} de ${load.capacity} puntos`} className="w-28 sm:w-36" />
      {load.overloaded && <StateLabel hue="coral" icon={Alert02Icon}>Sobrecargado</StateLabel>}
      <IconButton icon={Edit02Icon} label="Ajustar la capacidad" size="sm" variant="quiet" tooltipAlign="end" onClick={() => setEditing(true)} />
      {editing && <CapacityDialog projectId={projectId} current={override ?? load.capacity} estimated={override === null} onClose={() => setEditing(false)} />}
    </div>
  )
}

function CapacityDialog({ projectId, current, estimated, onClose }: { projectId: number; current: number; estimated: boolean; onClose: () => void }) {
  const save = useCapacity(projectId)
  const [value, setValue] = useState(String(current))
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const submit = async (points: number | null) => {
    if (points !== null && (!Number.isInteger(points) || points < 1 || points > 500)) return setError('Entre 1 y 500.')
    setSaving(true)
    const errors = await save(points)
    setSaving(false)
    if (errors.points_per_sprint) setError(errors.points_per_sprint)
    else onClose()
  }

  return (
    <Dialog
      title="Capacidad por sprint"
      description={estimated ? 'Hoy se estima con las horas y la seniority del equipo.' : 'Hoy usa el valor que pusiste a mano.'}
      onClose={onClose}
    >
      <form noValidate className="grid gap-5" onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(Number(value)) }}>
        <NumberField label="Puntos por sprint" unit="pts" value={value} error={error} hint="Entre 1 y 500." onChange={(e) => { setValue(e.target.value); setError(undefined) }} />
        <div className="flex flex-wrap justify-end gap-2">
          {!estimated && <Button variant="quiet" onClick={() => void submit(null)}>Volver a la estimación</Button>}
          <Button type="submit" variant="primary" loading={saving}>Guardar</Button>
        </div>
      </form>
    </Dialog>
  )
}
