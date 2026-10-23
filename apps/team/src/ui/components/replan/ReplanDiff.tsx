import { useState } from 'react'
import { useProposalActions } from '../../../application/use-cases/usePlanning'
import type { ReplanChange, ReplanContent } from '../../../domain/proposalContent'
import type { Proposal } from '../../../domain/proposals'
import { plural } from '../../format'
import { Block, Button, Card, Checkbox, Icon, Pill, StateLabel } from '@agile/ui'
import { AiMagicIcon, HourglassIcon, InformationCircleIcon, Settings01Icon, Tick02Icon } from '@agile/ui/icons'
import { STATUS_LABELS } from '../board/boardLabels'
import { RejectDialog } from '../planning/RejectDialog'

const GROUPS: { kind: ReplanChange['kind']; title: string }[] = [
  { kind: 'move', title: 'Mover' },
  { kind: 'reassign', title: 'Reasignar' },
  { kind: 'add', title: 'Agregar' },
  { kind: 'discard', title: 'Descartar' },
]

function describe(change: ReplanChange): string {
  switch (change.kind) {
    case 'move': return `${change.task_key} pasa a la etapa ${change.to_sprint}`
    case 'reassign': return `${change.task_key} pasa a ${change.to_member}`
    case 'add': return `${change.new_story.key} ${change.new_story.title}, en la etapa ${change.to_sprint}`
    case 'discard': return `${change.task_key} sale del plan (hoy en ${STATUS_LABELS[change.expected_status]})`
  }
}

/** Each change with its reason and a box to keep it. Dropping some approves the rest as an adjustment.
 *  Without `canDecide` (a member) it's the same list, read only, waiting for a leader. */
export function ReplanDiff({ projectId, proposal, content, canDecide = true }: { projectId: number; proposal: Proposal; content: ReplanContent; canDecide?: boolean }) {
  const { approve, adjust, reject } = useProposalActions(projectId)
  const [kept, setKept] = useState(() => content.changes.map(() => true))
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const count = kept.filter(Boolean).length
  const automatic = proposal.origin === 'automatic'

  const decide = async () => {
    if (count === content.changes.length) return approve.mutate(proposal.id)
    setSaving(true)
    await adjust(proposal.id, { ...content, changes: content.changes.filter((_, i) => kept[i]) })
    setSaving(false)
  }

  return (
    <Card as="article" padding="lg" className="grid gap-5" aria-label="Replan propuesto">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-soft text-violet">
            <Icon icon={AiMagicIcon} />
          </span>
          <div className="grid min-w-0">
            <h2 className="text-heading">Replan con {plural(content.changes.length, 'cambio')}</h2>
            <span className="text-caption text-ink-muted">{automatic ? 'Lo pidió el cierre de una etapa o un cambio del equipo' : canDecide ? 'Lo pediste tú' : 'Lo pidió un líder'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {automatic && <Pill hue="neutral" icon={Settings01Icon}>Automático</Pill>}
          <Pill hue="amber" icon={HourglassIcon}>{canDecide ? 'Espera tu decisión' : 'Espera al líder'}</Pill>
        </div>
      </header>
      <div className="flex gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
        <Icon icon={InformationCircleIcon} className="mt-0.5" />
        <p className="text-body">{content.rationale}</p>
      </div>
      {GROUPS.map(({ kind, title }) => {
        const items = content.changes.map((c, i) => [c, i] as const).filter(([c]) => c.kind === kind)
        if (!items.length) return null
        return (
          <Block key={kind} title={title}>
            <ul className="grid gap-1.5">
              {items.map(([change, i]) => (
                <li key={i} className="grid gap-1 rounded-md bg-inset px-4 py-3">
                  {canDecide ? (
                    <Checkbox
                      label={<span className="text-label">{describe(change)}</span>}
                      checked={kept[i]}
                      onChange={(e) => setKept(kept.map((k, j) => (j === i ? e.target.checked : k)))}
                    />
                  ) : (
                    <span className="text-label">{describe(change)}</span>
                  )}
                  <p className={canDecide ? 'pl-8 text-caption text-ink-muted' : 'text-caption text-ink-muted'}>{change.rationale}</p>
                </li>
              ))}
            </ul>
          </Block>
        )
      })}
      {!canDecide ? (
        <StateLabel hue="amber" icon={HourglassIcon}>Esperando la aprobación del líder</StateLabel>
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={Tick02Icon} disabled={count === 0} loading={saving || approve.isPending} onClick={decide}>
          {count === content.changes.length ? 'Aprobar el replan' : `Aprobar ${plural(count, 'cambio')}`}
        </Button>
        <Button variant="quiet" onClick={() => setRejecting(true)}>Rechazar</Button>
      </div>
      )}
      {rejecting && <RejectDialog what="el replan" onReject={(reason) => reject(proposal.id, reason)} onClose={() => setRejecting(false)} />}
    </Card>
  )
}
