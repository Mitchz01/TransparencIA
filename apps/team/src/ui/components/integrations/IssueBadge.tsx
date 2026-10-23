import type { IssueRef } from '../../../domain/board'
import { cn, Icon } from '@agile/ui'
import { Alert02Icon, GithubIcon } from '@agile/ui/icons'

const STATES: Record<IssueRef['state'], string> = { open: 'abierta', closed: 'cerrada', merged: 'integrada' }

/** The task's issue number, linking to GitHub. A broken link says so in words. */
export function IssueBadge({ issue }: { issue: IssueRef }) {
  if (issue.broken) {
    return (
      <span className="inline-flex items-center gap-1 text-coral">
        <Icon icon={Alert02Icon} size={16} />#{issue.number} no se encuentra
      </span>
    )
  }
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={`Issue ${issue.number}, ${STATES[issue.state]}, en GitHub`}
      className={cn('inline-flex items-center gap-1 rounded-sm text-blue hover:underline', issue.state !== 'open' && 'text-teal')}
    >
      <Icon icon={GithubIcon} size={16} />#{issue.number}
      {issue.state !== 'open' && <span>{STATES[issue.state]}</span>}
    </a>
  )
}
