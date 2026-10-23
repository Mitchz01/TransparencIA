import { useState } from 'react'
import { useUpdateProject } from '../../application/use-cases/useUpdateProject'
import { canChangeMethodology } from '../../domain/project'
import { Tick02Icon } from '../components/ds/icons'
import { ProjectForm } from '../components/project/ProjectForm'
import { draftFrom, toProjectUpdate } from '../components/project/projectDraft'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

/** The project, its team and auto-approve. The methodology locks once planning starts, and says why. */
export function SettingsPage() {
  const project = useCurrentProject()
  const save = useUpdateProject(project.id)
  // The form keeps what was typed; it starts again only when another project opens.
  const [initial] = useState(() => draftFrom(project))
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Ajustes" description="Los cambios en el equipo quedan en la actividad y pueden pedir una replanificación." />
      <ProjectForm
        key={project.id}
        initial={initial}
        submitLabel="Guardar cambios"
        submitIcon={Tick02Icon}
        methodologyLocked={canChangeMethodology(project) ? undefined : 'La planificación ya empezó, así que la metodología no se puede cambiar.'}
        onSubmit={(draft) => save(toProjectUpdate(project, draft))}
      />
    </div>
  )
}
