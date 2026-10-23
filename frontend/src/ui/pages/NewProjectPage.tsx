import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject } from '../../application/use-cases/useCreateProject'
import { ButtonLink } from '../components/ds'
import { AiMagicIcon } from '../components/ds/icons'
import { ProjectForm } from '../components/project/ProjectForm'
import { emptyDraft, toProjectCreate } from '../components/project/projectDraft'
import { AppLayout } from '../components/shell/AppLayout'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeTopBar } from '../components/shell/TopBar'

export function NewProjectPage() {
  const navigate = useNavigate()
  const [initial] = useState(emptyDraft)
  const create = useCreateProject(useCallback((id: number) => navigate(`/projects/${id}/planning`), [navigate]))

  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Nuevo proyecto" description="Descríbelo y suma a tu equipo. Al guardar, los agentes empiezan a planificar." />
        <ProjectForm
          initial={initial}
          submitLabel="Crear y planificar"
          submitIcon={AiMagicIcon}
          onSubmit={(draft) => create(toProjectCreate(draft))}
          secondaryAction={<ButtonLink to="/" variant="quiet" size="lg">Cancelar</ButtonLink>}
        />
      </div>
    </AppLayout>
  )
}
