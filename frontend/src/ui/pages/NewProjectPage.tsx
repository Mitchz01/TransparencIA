import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject } from '../../application/use-cases/useCreateProject'
import { useMe } from '../../application/use-cases/useSession'
import { ButtonLink } from '../components/ds'
import { Add01Icon } from '../components/ds/icons'
import { ProjectForm } from '../components/project/ProjectForm'
import { emptyDraft, toProjectCreate } from '../components/project/projectDraft'
import { AppLayout } from '../components/shell/AppLayout'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeTopBar } from '../components/shell/TopBar'

export function NewProjectPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const profileRole = me?.role ?? null
  const [initial] = useState(() => emptyDraft(profileRole))
  // Straight to the team, so the link to share is the first thing the leader sees.
  const create = useCreateProject(useCallback((id: number) => navigate(`/projects/${id}/team`), [navigate]))
  const roleField = profileRole ? 'optional' : 'required'

  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Nuevo proyecto" description="Descríbelo y suma a tu equipo con un link. Cuando estén todos, los agentes planifican." />
        <ProjectForm
          initial={initial}
          roleField={roleField}
          submitLabel="Crear proyecto"
          submitIcon={Add01Icon}
          onSubmit={(draft) => create(toProjectCreate(draft, roleField))}
          secondaryAction={<ButtonLink to="/" variant="quiet" size="lg">Cancelar</ButtonLink>}
        />
      </div>
    </AppLayout>
  )
}
