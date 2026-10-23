import { useRef, useState } from 'react'
import { useToasts } from '../../../application/toasts'
import { useInvitation, useTeam } from '../../../application/use-cases/useTeam'
import { invitationLink } from '../../../domain/account'
import { Button, Card, Dialog, Segmented, Skeleton, StateLabel, TextField } from '../ds'
import { Copy01Icon, Link01Icon, RefreshIcon, Tick02Icon } from '../ds/icons'

/** The project's one link (leaders only): copy it, replace it, or turn invitations off (spec 015, US4). */
export function InvitationCard({ projectId }: { projectId: number }) {
  const { data: invitation, isPending } = useInvitation(projectId, true)
  const team = useTeam(projectId)
  const { push } = useToasts()
  const field = useRef<HTMLInputElement>(null)
  const [renewing, setRenewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const link = invitation?.token ? invitationLink(window.location.origin, invitation.token) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      push({ tone: 'success', message: 'Link copiado' })
    } catch {
      // No clipboard (an old browser or a blocked permission): leave it selected to copy by hand.
      field.current?.select()
      push({ tone: 'info', message: 'El link está seleccionado. Cópialo con Ctrl+C.' })
    }
  }

  const toggle = async (on: boolean) => {
    setBusy(true)
    if (on) await team.renewInvitation()
    else await team.disableInvitation()
    setBusy(false)
  }

  return (
    <Card padding="lg" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-xl gap-1">
          <h2 className="text-heading">Invitar con un link</h2>
          <p className="text-body text-ink-muted">Compártelo por chat o correo. Quien lo abra entra como miembro con su perfil.</p>
        </div>
        {invitation && (
          <Segmented
            label="Invitaciones activas"
            inset
            size="sm"
            disabled={busy}
            value={invitation.active ? 'on' : 'off'}
            options={[{ value: 'off', label: 'Desactivadas' }, { value: 'on', label: 'Activas' }]}
            onChange={(v) => void toggle(v === 'on')}
          />
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : invitation?.active ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField ref={field} label="Link de invitación" hideLabel readOnly value={link} className="min-w-0 flex-1 basis-72" onFocus={(e) => e.target.select()} />
          <Button variant="primary" size="lg" icon={copied ? Tick02Icon : Copy01Icon} onClick={() => void copy()}>
            {copied ? 'Copiado' : 'Copiar link'}
          </Button>
          <Button size="lg" icon={RefreshIcon} onClick={() => setRenewing(true)}>Crear link nuevo</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-inset p-4">
          <StateLabel hue="neutral" icon={Link01Icon}>Nadie puede unirse con un link</StateLabel>
          <Button size="sm" icon={RefreshIcon} loading={busy} onClick={() => void toggle(true)}>Activar con un link nuevo</Button>
        </div>
      )}

      {renewing && (
        <Dialog
          title="Crear link nuevo"
          description="El link anterior deja de funcionar. Quien ya se unió sigue en el equipo."
          onClose={() => setRenewing(false)}
          actions={
            <>
              <Button variant="quiet" onClick={() => setRenewing(false)}>Cancelar</Button>
              <Button
                variant="primary"
                icon={RefreshIcon}
                loading={busy}
                onClick={async () => {
                  setBusy(true)
                  const ok = await team.renewInvitation()
                  setBusy(false)
                  if (ok) {
                    setRenewing(false)
                    push({ tone: 'success', message: 'Link nuevo listo. El anterior ya no funciona.' })
                  }
                }}
              >
                Crear link nuevo
              </Button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </Card>
  )
}
