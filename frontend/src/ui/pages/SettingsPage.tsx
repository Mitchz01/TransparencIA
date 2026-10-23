import { useState } from 'react'
import { useCanManage } from '../../application/use-cases/useSession'
import { useUpdateProject } from '../../application/use-cases/useUpdateProject'
import { canChangeMethodology } from '../../domain/project'
import { ButtonLink, EmptyState } from '../components/ds'
import { Settings01Icon, Tick02Icon, UserGroupIcon } from '../components/ds/icons'
import { ProjectForm } from '../components/project/ProjectForm'
import { draftFrom, toProjectUpdate } from '../components/project/projectDraft'
import { PageHeader } from '../components/shell/PageHeader'
import { useCurrentProject } from './ProjectLayout'

/** The project and auto-approve, for leaders. The methodology locks once planning starts, and says why.
 *  The team has its own screen (spec 015). */
export function SettingsPage() {
  const project = useCurrentProject()
  const manage = useCanManage(project.id)
  const save = useUpdateProject(project.id)
  // The form keeps what was typed; it starts again only when another project opens.
  const [initial] = useState(() => draftFrom(project))
  const team = <ButtonLink to={`/projects/${project.id}/team`} icon={UserGroupIcon}>Ir al equipo</ButtonLink>

  if (!manage) {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <EmptyState icon={Settings01Icon} title="Los ajustes son de los líderes" action={team}>
          Puedes ver todo el proyecto y trabajar en el tablero. Para cambiar la descripción o la metodología, habla con un líder.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Ajustes" description="El proyecto y cómo se aprueban las propuestas. El equipo y las invitaciones están en Equipo." actions={team} />
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
