import { useState } from 'react'
import type { Member } from '../../../domain/project'
import { Avatar, Button, Card, StateLabel, TextField } from '../ds'
import { Alert02Icon, Tick02Icon } from '../ds/icons'

interface Props {
  members: Member[]
  /** Leaders only (spec 015); without it each row just shows the username. */
  onSave?: (memberId: number, username: string | null) => Promise<{ errors: Record<string, string>; warning?: string }>
}

function MemberRow({ member, onSave }: { member: Member; onSave: NonNullable<Props['onSave']> }) {
  const [value, setValue] = useState(member.github_username ?? '')
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<{ text: string; warning: boolean }>()
  const [saving, setSaving] = useState(false)
  const dirty = value.trim() !== (member.github_username ?? '')

  const save = async () => {
    const username = value.trim() || null
    if (username && !/^[A-Za-z0-9-]{1,39}$/.test(username)) return setError('Solo letras, números y guiones, hasta 39.')
    setSaving(true)
    const { errors, warning } = await onSave(member.id, username)
    setSaving(false)
    if (errors.github_username) setError(errors.github_username)
    else setNote(warning ? { text: warning, warning: true } : { text: 'Guardado.', warning: false })
  }

  return (
    <li className="grid items-start gap-3 rounded-md bg-inset p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <span className="flex min-w-0 items-center gap-3 sm:min-h-control-md">
        <Avatar name={member.name} className="bg-surface" />
        <span className="grid min-w-0">
          <span className="truncate text-label">{member.name}</span>
          <span className="text-caption text-ink-muted">{member.role}</span>
        </span>
      </span>
      <div className="grid gap-1">
        <TextField
          label={`Usuario de GitHub de ${member.name}`}
          hideLabel
          size="md"
          fill="surface"
          placeholder="usuario"
          value={value}
          error={error}
          onChange={(e) => {
            setValue(e.target.value)
            setError(undefined)
            setNote(undefined)
          }}
        />
        {note && (
          <StateLabel hue={note.warning ? 'amber' : 'teal'} icon={note.warning ? Alert02Icon : Tick02Icon} className="text-caption">
            {note.text}
          </StateLabel>
        )}
      </div>
      <Button disabled={!dirty} loading={saving} onClick={save}>Guardar</Button>
    </li>
  )
}

/** Each member's GitHub user, so issues get assigned and reviewers can be suggested. */
export function MemberGithubUsers({ members, onSave }: Props) {
  return (
    <Card padding="lg" className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-heading">Usuarios del equipo</h2>
        <p className="text-body text-ink-muted">Con su usuario, las issues se asignan a quien corresponde y se sugieren revisores.</p>
      </div>
      <ul className="grid gap-2">
        {members.map((m) =>
          onSave ? (
            <MemberRow key={m.id} member={m} onSave={onSave} />
          ) : (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-md bg-inset p-4">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name} className="bg-surface" />
                <span className="grid min-w-0">
                  <span className="truncate text-label">{m.name}</span>
                  <span className="text-caption text-ink-muted">{m.role}</span>
                </span>
              </span>
              <span className="truncate text-label text-ink-muted">{m.github_username ?? 'Sin usuario'}</span>
            </li>
          ),
        )}
      </ul>
    </Card>
  )
}
