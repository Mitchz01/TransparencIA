import { useState } from 'react'
import { useTeam } from '../../../application/use-cases/useTeam'
import type { Account } from '../../../domain/account'
import type { Member, Project } from '../../../domain/project'
import { SENIORITY_LABELS } from '../account/profileLabels'
import { Avatar, Button, Dialog, FieldError, Icon, Menu, Pill, type MenuItem } from '@agile/ui'
import { Clock01Icon, CrownIcon, Layers01Icon, Logout01Icon, MoreHorizontalIcon, UserEdit01Icon, UserIcon, UserRemove01Icon } from '@agile/ui/icons'
import { MemberDialog } from './MemberDialog'

interface MemberListProps {
  project: Project
  me: Account
  /** Leaders get a menu per row; members only see the list and can leave. */
  manage: boolean
  /** After leaving: the project isn't yours any more. */
  onLeft: () => void
}

type Confirm = { kind: 'remove' | 'leave'; member: Member }

/** Everyone in the project with their data in it, the leaders marked, and "Tú" on your row (spec 015, US6). */
export function MemberList({ project, me, manage, onLeft }: MemberListProps) {
  const team = useTeam(project.id)
  const [editing, setEditing] = useState<Member | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [busy, setBusy] = useState(false)
  // A 409 last_leader is said next to the member it was about (contract, section 2).
  const [notes, setNotes] = useState<Record<number, string>>({})

  const note = (memberId: number, text?: string) => setNotes(({ [memberId]: _old, ...rest }) => (text ? { ...rest, [memberId]: text } : rest))

  const setPermission = async (member: Member, permission: Member['permission']) => {
    note(member.id)
    const outcome = await team.setPermission(member.id, permission)
    if (outcome.lastLeader) note(member.id, outcome.lastLeader)
  }

  const runConfirm = async () => {
    if (!confirm) return
    const { kind, member } = confirm
    note(member.id)
    setBusy(true)
    const outcome = await team.remove(member.id, { leaving: kind === 'leave' })
    setBusy(false)
    setConfirm(null)
    if (outcome.lastLeader) note(member.id, outcome.lastLeader)
    else if (outcome.ok && kind === 'leave') onLeft()
  }

  const menuFor = (member: Member, mine: boolean): MenuItem[] => [
    { key: 'edit', label: 'Editar', icon: UserEdit01Icon, onSelect: () => setEditing(member) },
    member.permission === 'leader'
      ? { key: 'demote', label: 'Quitar como líder', icon: CrownIcon, onSelect: () => void setPermission(member, 'member') }
      : { key: 'promote', label: 'Hacer líder', icon: CrownIcon, onSelect: () => void setPermission(member, 'leader') },
    mine
      ? { key: 'leave', label: 'Salir del proyecto', icon: Logout01Icon, onSelect: () => setConfirm({ kind: 'leave', member }) }
      : { key: 'remove', label: 'Quitar del equipo', icon: UserRemove01Icon, onSelect: () => setConfirm({ kind: 'remove', member }) },
  ]

  return (
    <>
      <ul aria-label="Miembros del equipo" className="grid gap-1.5">
        {project.members.map((member) => {
          const mine = member.account_id === me.id
          return (
            <li key={member.id} className="grid gap-3 rounded-md bg-inset p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={member.name} src={member.avatar_url} className="mt-0.5 bg-surface" />
                <div className="grid min-w-0 gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-label">{member.name}</span>
                    {mine && <Pill hue="neutral">Tú</Pill>}
                    {member.permission === 'leader' && <Pill hue="lime" icon={CrownIcon}>Líder</Pill>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted tabular-nums">
                    <span className="inline-flex items-center gap-1.5"><Icon icon={UserIcon} size={16} />{member.role}</span>
                    <span className="inline-flex items-center gap-1.5"><Icon icon={Layers01Icon} size={16} />{SENIORITY_LABELS[member.seniority]}</span>
                    <span className="inline-flex items-center gap-1.5"><Icon icon={Clock01Icon} size={16} />{member.hours_per_week} h por semana</span>
                  </div>
                  {member.skills.length > 0 && (
                    <ul aria-label={`Habilidades de ${member.name}`} className="flex flex-wrap gap-1.5">
                      {member.skills.map((skill) => (
                        <li key={skill} className="inline-flex h-6 items-center rounded-pill bg-surface px-2.5 text-caption text-ink">{skill}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                {manage ? (
                  <Menu label={`Opciones de ${member.name}`} items={menuFor(member, mine)} icon={MoreHorizontalIcon} chevron={false} variant="quiet" size="sm" align="end" buttonClassName="size-control-sm px-0">
                    {null}
                  </Menu>
                ) : (
                  mine && <Button variant="quiet" size="sm" icon={Logout01Icon} onClick={() => setConfirm({ kind: 'leave', member })}>Salir del proyecto</Button>
                )}
              </div>
              {notes[member.id] && (
                <div role="alert" className="sm:col-span-2">
                  <FieldError>{notes[member.id]}</FieldError>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {editing && <MemberDialog member={editing} onSave={(update) => team.updateMember(editing.id, update)} onClose={() => setEditing(null)} />}

      {confirm && (
        <Dialog
          title={confirm.kind === 'leave' ? `Salir de ${project.name}` : `Quitar a ${confirm.member.name}`}
          description={
            confirm.kind === 'leave'
              ? 'Dejas de ver el proyecto. Tus actividades pendientes quedan sin asignar y las terminadas conservan tu nombre.'
              : 'Deja de ver el proyecto. Sus actividades pendientes quedan sin asignar y las terminadas conservan su nombre.'
          }
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button variant="quiet" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button variant="primary" icon={confirm.kind === 'leave' ? Logout01Icon : UserRemove01Icon} loading={busy} onClick={() => void runConfirm()}>
                {confirm.kind === 'leave' ? 'Salir del proyecto' : 'Quitar del equipo'}
              </Button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </>
  )
}
