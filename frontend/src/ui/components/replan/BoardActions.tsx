import { useState, type FormEvent } from 'react'
import { useReplan } from '../../../application/use-cases/useReplan'
import type { Sprint, Task } from '../../../domain/board'
import { REASON_MAX } from '../../../domain/proposals'
import { formatDate, plural } from '../../format'
import { Button, Dialog, StateLabel, TextArea } from '../ds'
import { AiMagicIcon, Alert02Icon, Tick02Icon } from '../ds/icons'

export function ReplanDialog({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { replan } = useReplan(projectId)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = reason.trim()
    if (!clean) return setError('Cuéntale al agente qué cambió.')
    if (clean.length > REASON_MAX) return setError(`Usa menos de ${REASON_MAX} caracteres.`)
    setSending(true)
    const errors = await replan(clean)
    setSending(false)
    if (errors.reason) setError(errors.reason)
    else onClose()
  }

  return (
    <Dialog title="Replanificar" description="El agente revisa el tablero con tu motivo y te propone cambios. Nada cambia hasta que los apruebes." onClose={onClose}>
      <form noValidate className="grid gap-5" onSubmit={submit}>
        <TextArea
          label="Motivo"
          value={reason}
          error={error}
          hint={`Hasta ${REASON_MAX} caracteres.`}
          placeholder="Sara se va dos semanas y el pago es más urgente."
          onChange={(e) => {
            setReason(e.target.value)
            setError(undefined)
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={AiMagicIcon} loading={sending}>Pedir replan</Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Closes the sprint after a confirmation that says what stays unfinished and whether its end date passed. */
export function CloseSprintButton({ projectId, sprint, tasks }: { projectId: number; sprint: Sprint; tasks: Task[] }) {
  const { closeSprint } = useReplan(projectId)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const pending = tasks.filter((t) => t.sprint_id === sprint.id && t.status !== 'done')
  const past = sprint.end_date !== null && sprint.end_date < new Date().toISOString().slice(0, 10)

  if (sprint.closed) return <StateLabel hue="teal" icon={Tick02Icon}>Sprint cerrado</StateLabel>

  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>Cerrar sprint</Button>
      {open && (
        <Dialog
          title={`Cerrar ${sprint.name}`}
          description={sprint.end_date ? `Termina el ${formatDate(sprint.end_date)}.` : undefined}
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button variant="quiet" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                variant="primary"
                loading={closing}
                onClick={async () => {
                  setClosing(true)
                  if (await closeSprint(sprint.id)) setOpen(false)
                  setClosing(false)
                }}
              >
                Cerrar sprint
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            {past && <StateLabel hue="amber" icon={Alert02Icon}>La fecha de fin ya pasó</StateLabel>}
            <p className="text-body">
              {pending.length
                ? `Quedan ${plural(pending.length, 'tarea')} sin terminar: ${pending.map((t) => t.key).join(', ')}. Al cerrar, el agente propone a dónde llevarlas.`
                : 'Todas las tareas están terminadas.'}
            </p>
          </div>
        </Dialog>
      )}
    </>
  )
}
