import { useNavigate } from 'react-router-dom'
import { useCanManage, useMe } from '../../application/use-cases/useSession'
import { plural } from '../format'
import { Card } from '@agile/ui'
import { PageHeader } from '../components/shell/PageHeader'
import { InvitationCard } from '../components/team/InvitationCard'
import { MemberList } from '../components/team/MemberList'
import { useCurrentProject } from './ProjectLayout'

/** Who works on the project and how people join it (spec 015, US4 and US6). */
export function TeamPage() {
  const project = useCurrentProject()
  const { data: me } = useMe()
  const manage = useCanManage(project.id)
  const navigate = useNavigate()
  if (!me) return null

  return (
    <div className="mx-auto grid max-w-4xl gap-3 [&>*]:min-w-0">
      <PageHeader
        title="Equipo"
        description={
          manage
            ? 'Invita con un link. Cada persona entra con su perfil y tú ajustas su cargo en este proyecto.'
            : 'Quién trabaja en el proyecto. Los líderes deciden los cargos y las invitaciones.'
        }
      />
      {manage && <InvitationCard projectId={project.id} />}
      <Card padding="lg" className="grid gap-5">
        <div className="grid gap-1">
          <h2 className="text-heading">{plural(project.members.length, 'persona')}</h2>
          <p className="text-body text-ink-muted">Cada cambio queda en la actividad y puede pedir una replanificación.</p>
        </div>
        <MemberList project={project} me={me} manage={manage} onLeft={() => navigate('/', { replace: true })} />
      </Card>
    </div>
  )
}
