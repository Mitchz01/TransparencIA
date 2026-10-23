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
        <PageHeader title="New project" description="Describe it and add your team. When you save, the agents start planning." />
        <ProjectForm
          initial={initial}
          submitLabel="Create and start planning"
          submitIcon={AiMagicIcon}
          onSubmit={(draft) => create(toProjectCreate(draft))}
          secondaryAction={<ButtonLink to="/" variant="quiet" size="lg">Cancel</ButtonLink>}
        />
      </div>
    </AppLayout>
  )
}
