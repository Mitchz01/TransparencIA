import { useState, type FormEvent } from 'react'
import { REPOSITORY_PATTERN } from '../../../domain/integrations'
import type { FieldErrors } from '../../../domain/rules'
import { Button, Card, Dialog, StateLabel, TextField } from '../ds'
import { GithubIcon, Plug01Icon, Tick02Icon } from '../ds/icons'

interface RepositoryFormProps {
  repository: string | null
  hasToken: boolean
  onConnect: (body: { repository: string; token?: string }) => Promise<FieldErrors>
  onDisconnect: () => Promise<void>
}

/** owner/name and an optional token. The token is write-only: never shown, only "there is one saved". */
export function RepositoryForm({ repository, hasToken, onConnect, onDisconnect }: RepositoryFormProps) {
  const [repo, setRepo] = useState(repository ?? '')
  const [token, setToken] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const send = async () => {
    setConfirming(false)
    setSending(true)
    const result = await onConnect({ repository: repo.trim(), ...(token && { token }) })
    setSending(false)
    setErrors(result)
    if (!Object.keys(result).length) setToken('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!REPOSITORY_PATTERN.test(repo.trim())) return setErrors({ repository: 'Usa el formato dueño/nombre, por ejemplo acme/tienda.' })
    if (repository && repository !== repo.trim()) return setConfirming(true)
    void send()
  }

  return (
    <Card padding="lg" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-heading">Repositorio</h2>
          <p className="text-body text-ink-muted">Las tareas se publican como issues y los PR vuelven al tablero.</p>
        </div>
        {repository && <StateLabel hue="teal" icon={Tick02Icon}>Conectado a {repository}</StateLabel>}
      </div>
      <form noValidate onSubmit={submit} className="grid gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label="Repositorio"
            placeholder="acme/tienda"
            value={repo}
            error={errors.repository}
            autoComplete="off"
            onChange={(e) => {
              setRepo(e.target.value)
              setErrors({})
            }}
          />
          <TextField
            label="Token"
            type="password"
            autoComplete="new-password"
            value={token}
            error={errors.token}
            hint={hasToken ? 'Hay un token guardado. Déjalo vacío para mantenerlo.' : 'Opcional. Sin token, nada se envía a GitHub.'}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" icon={repository ? GithubIcon : Plug01Icon} loading={sending}>
            {repository ? 'Guardar' : 'Conectar'}
          </Button>
          {repository && <Button variant="quiet" onClick={() => void onDisconnect()}>Desconectar</Button>}
        </div>
      </form>
      {confirming && (
        <Dialog
          title="Cambiar el repositorio"
          description={`El proyecto deja de usar ${repository} y pasa a ${repo.trim()}. Las issues ya publicadas quedan donde están.`}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <Button variant="quiet" onClick={() => setConfirming(false)}>Cancelar</Button>
              <Button variant="primary" onClick={() => void send()}>Cambiar</Button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </Card>
  )
}
