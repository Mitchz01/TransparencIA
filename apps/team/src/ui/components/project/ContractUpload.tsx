// Spec 017, US7: the leader uploads the contract and the AI reads it into the project's data.
// Only the structure for now: the backend's contract reader fills `ContractReading`.

import { useId, useState, type DragEvent } from 'react'
import type { ContractReading } from '../../../domain/contracts'
import { CONTRACT_LIMITS } from '../../../domain/contracts'
import { useReadContract, type ContractProblem } from '../../../application/use-cases/useContracts'
import { Button, Card, cn, FieldError, Icon } from '@agile/ui'
import { AiMagicIcon, File01Icon, Loading03Icon, RefreshIcon } from '@agile/ui/icons'

const PROBLEMS: Record<ContractProblem, string> = {
  unsupported_file: 'Sube el contrato en PDF, de hasta 10 MB.',
  agent_unavailable: 'No pudimos leer el contrato. Prueba de nuevo o llena el formulario a mano.',
}

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** What the AI read, so the leader sees it before the form below fills. */
function Reading({ reading }: { reading: ContractReading }) {
  const facts = [
    ['Contratante', reading.contracting_entity],
    ['Contratista', reading.contractor],
    ['Valor', reading.contract_value === null ? null : `$${pesos.format(reading.contract_value)}`],
    ['Duración', reading.duration_weeks === null ? null : `${reading.duration_weeks} semanas`],
  ] as const
  return (
    <div className="grid gap-3 rounded-md bg-inset p-4">
      <p className="inline-flex items-center gap-2 text-label">
        <Icon icon={AiMagicIcon} size={16} />
        Esto leyó la IA. Revísalo en el formulario de abajo antes de registrar.
      </p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {facts.map(([name, value]) => (
          <div key={name} className="flex justify-between gap-3 text-caption">
            <dt className="text-ink-muted">{name}</dt>
            <dd className="text-ink tabular-nums">{value ?? 'No lo dice'}</dd>
          </div>
        ))}
      </dl>
      {reading.milestones.length > 0 && (
        <ul className="grid gap-1 text-caption text-ink-muted" aria-label="Hitos del contrato">
          {reading.milestones.map((m) => <li key={m.name}>{m.name}{m.date ? `, antes del ${m.date}` : ''}</li>)}
        </ul>
      )}
    </div>
  )
}

export function ContractUpload({ onRead }: { onRead: (reading: ContractReading) => void }) {
  const inputId = useId()
  const { read, reading } = useReadContract()
  const [problem, setProblem] = useState<ContractProblem | null>(null)
  const [last, setLast] = useState<File | null>(null)
  const [result, setResult] = useState<ContractReading | null>(null)
  const [over, setOver] = useState(false)

  const send = async (file: File) => {
    setLast(file)
    if (!(CONTRACT_LIMITS.uploadTypes as readonly string[]).includes(file.type) || file.size > CONTRACT_LIMITS.uploadBytes) {
      setProblem('unsupported_file')
      return
    }
    setProblem(null)
    const outcome = await read(file)
    if (outcome.ok) {
      setResult(outcome.reading)
      onRead(outcome.reading)
    } else setProblem(outcome.problem)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files[0]
    if (file && !reading) void send(file)
  }

  return (
    <Card id="contrato" padding="lg" className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-heading">Crear desde el contrato</h2>
        <p className="text-body text-ink-muted">Sube el contrato firmado y la IA llena los datos del proyecto: entidad, valor, plazo, rubros e hitos.</p>
      </div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-busy={reading || undefined}
        className={cn(
          'grid cursor-pointer justify-items-center gap-3 rounded-md px-6 py-8 text-center transition-[background-color] duration-150',
          over ? 'bg-primary-soft text-primary-soft-ink' : 'bg-inset hover:bg-surface-strong',
        )}
      >
        <span className="inline-flex size-12 items-center justify-center rounded-md bg-surface text-ink">
          <Icon icon={reading ? Loading03Icon : File01Icon} size={24} className={reading ? 'animate-spin' : undefined} />
        </span>
        {reading ? (
          <span className="text-label" role="status">Leyendo el contrato con IA…</span>
        ) : (
          <>
            <span className="text-label">Suelta aquí el contrato o haz clic para elegirlo</span>
            <span className="text-caption text-ink-muted">PDF, hasta 10 MB. Nada se guarda hasta que registres el proyecto.</span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept={CONTRACT_LIMITS.uploadTypes.join(',')}
          className="sr-only"
          disabled={reading}
          aria-label="Subir contrato"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void send(file)
          }}
        />
      </label>
      {problem && !reading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FieldError>{PROBLEMS[problem]}</FieldError>
          {problem === 'agent_unavailable' && last && <Button size="sm" icon={RefreshIcon} onClick={() => void send(last)}>Reintentar</Button>}
        </div>
      )}
      {result && !reading && <Reading reading={result} />}
    </Card>
  )
}
