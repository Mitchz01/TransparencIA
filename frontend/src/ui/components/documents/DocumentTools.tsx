import { useState, type FormEvent } from 'react'
import { DOCUMENT_LIMITS, type DocumentVersion } from '../../../domain/documents'
import type { FieldErrors } from '../../../domain/rules'
import { formatDate } from '../../format'
import { Button, Dialog, FieldError, Menu, StateLabel, TextArea } from '../ds'
import { Alert02Icon, Clock01Icon, RefreshIcon, Tick02Icon } from '../ds/icons'

const versionText = (v: DocumentVersion) => `${formatDate(v.created_at)}, ${v.source === 'leader' ? 'editada por ti' : 'del agente'}`

/** Every version stays available; picking one shows it read-only. */
export function VersionHistory({ versions, current, shown, onPick }: { versions: DocumentVersion[]; current: number; shown: number; onPick: (version: number) => void }) {
  return (
    <Menu
      label={`Versión ${shown}`}
      icon={Clock01Icon}
      size="sm"
      align="end"
      items={[...versions].reverse().map((v) => ({
        key: String(v.version),
        label: v.version === current ? `Versión ${v.version}, la actual` : `Versión ${v.version}`,
        caption: versionText(v),
        selected: v.version === shown,
        onSelect: () => onPick(v.version),
      }))}
    >
      Versión {shown}
    </Menu>
  )
}

export function RegenerateDialog({ title, onRegenerate, onClose }: { title: string; onRegenerate: (instructions: string) => Promise<FieldErrors>; onClose: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = text.trim()
    if (!clean) return setError('Escribe qué debería cambiar.')
    if (clean.length > DOCUMENT_LIMITS.instructions) return setError(`Usa menos de ${DOCUMENT_LIMITS.instructions} caracteres.`)
    setSending(true)
    const errors = await onRegenerate(clean)
    setSending(false)
    if (errors.instructions) setError(errors.instructions)
    else onClose()
  }

  return (
    <Dialog title={`Regenerar ${title}`} description="El redactor arma una versión nueva y te la propone. La actual no cambia hasta que la apruebes." onClose={onClose}>
      <form noValidate className="grid gap-5" onSubmit={submit}>
        <TextArea
          label="Instrucciones"
          value={text}
          error={error}
          hint={`Hasta ${DOCUMENT_LIMITS.instructions} caracteres.`}
          placeholder="Agrega el caso en que el repo está desconectado."
          onChange={(e) => {
            setText(e.target.value)
            setError(undefined)
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={RefreshIcon} loading={sending}>Regenerar</Button>
        </div>
      </form>
    </Dialog>
  )
}

interface DocumentEditorProps {
  initial: string
  diagram: boolean
  onSave: (content: string) => Promise<{ conflict: number | null; error?: string } | null>
  onCancel: () => void
  onReload: () => void
}

/** A hand edit saves a new version on top of the loaded one. If someone saved first, nothing typed is lost. */
export function DocumentEditor({ initial, diagram, onSave, onCancel, onReload }: DocumentEditorProps) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const save = async () => {
    if (!text.trim()) return setError('El documento no puede quedar vacío.')
    setSaving(true)
    const problem = await onSave(text)
    setSaving(false)
    if (problem) {
      setConflict(problem.conflict)
      setError(problem.error)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setError('No se pudo copiar. Selecciona el texto y cópialo a mano.')
    }
  }

  return (
    <div className="grid gap-4">
      {conflict !== null && (
        <div className="grid gap-3 rounded-md bg-amber-soft p-4">
          <StateLabel hue="amber" icon={Alert02Icon}>Alguien guardó la versión {conflict} mientras editabas</StateLabel>
          <p className="text-body text-ink">Tu texto sigue aquí. Cópialo y recarga para editar sobre la versión nueva.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={copied ? Tick02Icon : undefined} onClick={copy}>{copied ? 'Texto copiado' : 'Copiar mi texto'}</Button>
            <Button size="sm" variant="primary" icon={RefreshIcon} onClick={onReload}>Recargar</Button>
          </div>
        </div>
      )}
      <TextArea
        label={diagram ? 'Código del diagrama' : 'Contenido'}
        rows={18}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(undefined)
        }}
      />
      {error && <FieldError>{error}</FieldError>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={Tick02Icon} loading={saving} disabled={text === initial} onClick={save}>Guardar versión nueva</Button>
        <Button variant="quiet" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}
