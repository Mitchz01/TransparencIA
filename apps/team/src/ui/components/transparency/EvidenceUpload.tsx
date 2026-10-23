// Spec 017, US2 (owner: P4): drop an invoice, a field photo or a report; the AI reads it into a draft.

import { useId, useState, type DragEvent } from 'react'
import { TRANSPARENCY_LIMITS } from '@agile/domain'
import { Button, cn, FieldError, Icon } from '@agile/ui'
import { AiMagicIcon, CloudIcon, Loading03Icon, RefreshIcon } from '@agile/ui/icons'
import type { UploadOutcome, UploadProblem } from '../../../application/use-cases/useTransparency'

const ACCEPT = TRANSPARENCY_LIMITS.uploadTypes.join(',')

const PROBLEMS: Record<UploadProblem, string> = {
  unsupported_file: 'Ese archivo no sirve. Sube un PDF o una imagen (JPG, PNG o WebP) de hasta 10 MB.',
  agent_unavailable: 'No pudimos leer el documento. Prueba de nuevo en un momento.',
  budget_missing: 'Primero guarda el presupuesto del proyecto: la IA necesita los rubros para asignar el gasto.',
}

/** The same checks as the backend, so a wrong file never waits for the AI. */
function fileProblem(file: File): UploadProblem | null {
  const types: readonly string[] = TRANSPARENCY_LIMITS.uploadTypes
  return types.includes(file.type) && file.size <= TRANSPARENCY_LIMITS.uploadBytes ? null : 'unsupported_file'
}

interface EvidenceUploadProps {
  upload: (file: File) => Promise<UploadOutcome>
  uploading: boolean
}

export function EvidenceUpload({ upload, uploading }: EvidenceUploadProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [problem, setProblem] = useState<UploadProblem | null>(null)
  const [last, setLast] = useState<File | null>(null)
  const [over, setOver] = useState(false)

  const send = async (file: File) => {
    setLast(file)
    const local = fileProblem(file)
    setProblem(local)
    if (local) return
    const outcome = await upload(file)
    setProblem(outcome.ok ? null : outcome.problem)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files[0]
    if (file && !uploading) void send(file)
  }

  return (
    <div className="grid gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-busy={uploading || undefined}
        className={cn(
          'grid cursor-pointer justify-items-center gap-3 rounded-md px-6 py-10 text-center transition-[background-color] duration-150',
          over ? 'bg-primary-soft text-primary-soft-ink' : 'bg-inset hover:bg-surface-strong',
          uploading && 'cursor-progress',
        )}
      >
        <span className="inline-flex size-12 items-center justify-center rounded-md bg-surface text-ink">
          <Icon icon={uploading ? Loading03Icon : CloudIcon} size={24} className={uploading ? 'animate-spin' : undefined} />
        </span>
        {uploading ? (
          <span className="inline-flex items-center gap-2 text-label" role="status">
            <Icon icon={AiMagicIcon} size={16} />
            Leyendo el documento con IA…
          </span>
        ) : (
          <>
            <span className="text-label">Suelta aquí una factura, una foto de campo o un informe</span>
            <span className="text-caption text-ink-muted">PDF, JPG, PNG o WebP, hasta 10 MB. La IA propone el gasto y tú lo confirmas.</span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={uploading}
          aria-label="Subir evidencia"
          aria-invalid={problem === 'unsupported_file' || undefined}
          aria-describedby={problem ? errorId : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // the same file can be chosen again
            if (file) void send(file)
          }}
        />
      </label>

      {problem && !uploading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FieldError id={errorId}>{PROBLEMS[problem]}</FieldError>
          {problem === 'agent_unavailable' && last && (
            <Button size="sm" icon={RefreshIcon} onClick={() => void send(last)}>Reintentar</Button>
          )}
        </div>
      )}
    </div>
  )
}
