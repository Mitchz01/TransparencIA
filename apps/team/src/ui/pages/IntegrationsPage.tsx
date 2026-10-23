import { useBoard } from '../../application/use-cases/useBoard'
import { useGithubProposals, useIntegrations } from '../../application/use-cases/useIntegrations'
import { useCanManage } from '../../application/use-cases/useSession'
import { plural } from '../format'
import { Button, Card, Icon } from '@agile/ui'
import { GithubIcon, InformationCircleIcon } from '@agile/ui/icons'
import { GithubProposalCard } from '../components/integrations/GithubProposalCard'
import { MemberGithubUsers } from '../components/integrations/MemberGithubUsers'
import { RepositoryForm } from '../components/integrations/RepositoryForm'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

/** Without a token nothing reaches GitHub; the banner says so (spec 007). */
function TestModeBanner() {
  return (
    <div className="flex gap-3 rounded-lg bg-blue-soft p-4 text-blue">
      <Icon icon={InformationCircleIcon} className="mt-0.5" />
      <p className="text-body">
        <span className="font-semibold">Modo de prueba: nada se envía a GitHub.</span> Las issues se numeran aquí para ver el flujo. Agrega un token para publicar de verdad.
      </p>
    </div>
  )
}

export function IntegrationsPage() {
  const project = useCurrentProject()
  const integrations = useIntegrations(project.id)
  const pending = useGithubProposals(project.id)
  const { data: board } = useBoard(project.id)
  const withoutIssue = board?.tasks.filter((t) => !t.issue).length ?? 0
  const published = (board?.tasks.length ?? 0) - withoutIssue
  const publishing = pending.some((p) => p.key === 'create_issues')
  // GitHub is set up by the leaders (spec 015); members see how it's connected.
  const manage = useCanManage(project.id)

  return (
    <div className="mx-auto grid max-w-4xl gap-3 [&>*]:min-w-0">
      <PageHeader
        title="Integraciones"
        description={manage ? 'Conecta el repo de GitHub del proyecto, carga el usuario de cada miembro y publica las tareas como issues.' : 'El repo de GitHub del proyecto y el usuario de cada miembro. Los líderes los configuran.'}
      />
      {!project.has_token && <TestModeBanner />}
      {pending.map((p) => <GithubProposalCard key={p.id} projectId={project.id} proposal={p} decide={manage} />)}
      {manage ? (
        <RepositoryForm
          key={project.repository ?? 'none'}
          repository={project.repository}
          hasToken={Boolean(project.has_token)}
          onConnect={integrations.connect}
          onDisconnect={integrations.disconnect}
        />
      ) : (
        <Card padding="lg" className="flex flex-wrap items-center gap-3">
          <Icon icon={GithubIcon} />
          <div className="grid gap-0.5">
            <h2 className="text-heading">{project.repository ?? 'Sin repo conectado'}</h2>
            <p className="text-body text-ink-muted">{project.repository ? 'El repo del proyecto.' : 'Un líder puede conectarlo.'}</p>
          </div>
        </Card>
      )}
      <Card padding="lg" className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-heading">Issues</h2>
          <p className="text-body text-ink-muted">
            {!project.repository
              ? 'Conecta un repo para publicar las tareas.'
              : !board?.tasks.length
                ? 'Las tareas llegan cuando el plan esté completo.'
                : withoutIssue === 0
                  ? 'Todas las tareas ya tienen su issue.'
                  : `${plural(withoutIssue, 'tarea')} sin issue${published ? `, ${published} ya publicadas` : ''}.`}
          </p>
        </div>
        {manage && (
          <Button
            variant="primary"
            icon={GithubIcon}
            disabled={!project.repository || withoutIssue === 0 || publishing}
            onClick={() => void integrations.proposeIssues()}
          >
            {publishing ? 'Esperando tu decisión' : 'Publicar tareas pendientes'}
          </Button>
        )}
      </Card>
      <MemberGithubUsers members={project.members} onSave={manage ? integrations.setGithubUsername : undefined} />
    </div>
  )
}
