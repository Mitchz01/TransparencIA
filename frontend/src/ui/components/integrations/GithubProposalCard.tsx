import { useState } from 'react'
import { useProposalActions } from '../../../application/use-cases/usePlanning'
import type { CreateIssuesContent, RequestReviewContent, ReviewFinding } from '../../../domain/proposalContent'
import type { Proposal } from '../../../domain/proposals'
import { plural } from '../../format'
import { Block, Button, Card, Icon, Pill, Row, Rows, StateLabel } from '../ds'
import { Alert02Icon, GithubIcon, HourglassIcon, InformationCircleIcon, Tick02Icon, UserIcon } from '../ds/icons'
import { RejectDialog } from '../planning/RejectDialog'

const FINDINGS: Record<ReviewFinding['status'], { label: string; hue: 'teal' | 'amber' | 'coral' }> = {
  met: { label: 'Cumple', hue: 'teal' },
  partial: { label: 'A medias', hue: 'amber' },
  missing: { label: 'Falta', hue: 'coral' },
}

function IssuesBody({ content }: { content: CreateIssuesContent }) {
  return (
    <Block title={plural(content.tasks.length, 'tarea')}>
      <Rows>
        {content.tasks.slice(0, 8).map((t) => (
          <Row key={t.task_id} title={<span className="flex gap-2"><span className="text-key text-ink-muted">{t.key}</span>{t.title}</span>} />
        ))}
      </Rows>
      {content.tasks.length > 8 && <p className="text-caption text-ink-muted">Y {plural(content.tasks.length - 8, 'tarea')} más.</p>}
    </Block>
  )
}

function ReviewBody({ content }: { content: RequestReviewContent }) {
  return (
    <>
      <p className="text-body">{content.review.summary}</p>
      {!content.review.reviewed_fully && (
        <StateLabel hue="amber" icon={Alert02Icon}>El cambio era muy grande: se revisó una parte.</StateLabel>
      )}
      <Block title="Revisores sugeridos">
        <Rows>
          {content.reviewers.map((r) => <Row key={r.username} title={<span className="inline-flex items-center gap-2"><Icon icon={UserIcon} size={16} />{r.username}</span>} detail={r.reason} />)}
        </Rows>
      </Block>
      <Block title="Criterios de aceptación">
        <Rows>
          {content.review.findings.map((f) => (
            <Row key={f.criterion} title={f.criterion} detail={f.comment} aside={<Pill hue={FINDINGS[f.status].hue}>{FINDINGS[f.status].label}</Pill>} />
          ))}
        </Rows>
      </Block>
    </>
  )
}

/** A GitHub action waiting for the leader: publish issues, or request a review with the agent's comment. */
export function GithubProposalCard({ projectId, proposal }: { projectId: number; proposal: Proposal }) {
  const { approve, reject } = useProposalActions(projectId)
  const [rejecting, setRejecting] = useState(false)
  const issues = proposal.key === 'create_issues'
  const content = proposal.content as unknown
  const title = issues
    ? `Publicar ${plural((content as CreateIssuesContent).tasks.length, 'issue')}`
    : `Revisar el PR #${(content as RequestReviewContent).pr_number}`

  return (
    <Card as="article" padding="lg" className="grid gap-5" aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-soft text-blue">
            <Icon icon={GithubIcon} />
          </span>
          <h2 className="text-heading">{title}</h2>
        </div>
        <Pill hue="amber" icon={HourglassIcon}>Espera tu decisión</Pill>
      </header>
      <div className="flex gap-3 rounded-md bg-primary-soft p-4 text-primary-soft-ink">
        <Icon icon={InformationCircleIcon} className="mt-0.5" />
        <p className="text-body">{proposal.rationale}</p>
      </div>
      {issues ? <IssuesBody content={content as CreateIssuesContent} /> : <ReviewBody content={content as RequestReviewContent} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={Tick02Icon} loading={approve.isPending} onClick={() => approve.mutate(proposal.id)}>
          {issues ? 'Publicar' : 'Pedir la revisión'}
        </Button>
        <Button variant="quiet" onClick={() => setRejecting(true)}>Rechazar</Button>
      </div>
      {rejecting && <RejectDialog what={issues ? 'la publicación' : 'la revisión'} onReject={(reason) => reject(proposal.id, reason)} onClose={() => setRejecting(false)} />}
    </Card>
  )
}
