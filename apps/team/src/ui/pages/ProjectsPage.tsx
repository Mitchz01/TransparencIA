import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useProjects } from '../../application/use-cases/useProjects'
import { useMe } from '../../application/use-cases/useSession'
import { firstName } from '../../domain/launchpad'
import { ButtonLink } from '@agile/ui'
import { Add01Icon, File01Icon } from '@agile/ui/icons'
import { ProjectsTracker } from '../components/home/ProjectsTracker'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeShell, type HomeIntent } from '../components/shell/HomeShell'

/** The home (spec 016, reworked by spec 019): a follow-up panel of the entity's projects, with their progress,
 *  money spent and traffic light, and the way to register a new one. */
export function ProjectsPage() {
  const { data: projects, isPending } = useProjects()
  const { data: me } = useMe()
  const location = useLocation()
  const search = useRef<HTMLInputElement>(null)
  // A legal person's account greets its legal representative, not the organization (spec 020).
  const name = firstName(me?.person_type === 'juridica' ? me.legal_rep_name : me?.name)

  const onIntent = useCallback((intent: HomeIntent) => {
    if (intent === 'search') search.current?.focus()
    else window.scrollTo({ top: 0 })
  }, [])

  // Arriving from another screen's sidebar with something to do here.
  const focus = (location.state as { focus?: HomeIntent } | null)?.focus
  useEffect(() => {
    if (focus) onIntent(focus)
  }, [focus, onIntent])

  return (
    <HomeShell active="projects" onIntent={onIntent}>
      <div className="mx-auto max-w-[1200px] px-1 sm:px-4">
        <PageHeader
          title={name ? `¿Qué proyecto ejecutamos hoy, ${name}?` : '¿Qué proyecto ejecutamos hoy?'}
          description="Los proyectos que ejecuta tu entidad: cuánto han avanzado, cuánto dinero se ha ejecutado y cuáles necesitan atención."
          actions={
            <>
              <ButtonLink to="/projects/new#contrato" icon={File01Icon}>Crear desde contrato</ButtonLink>
              <ButtonLink to="/projects/new" variant="primary" icon={Add01Icon}>Registrar proyecto</ButtonLink>
            </>
          }
        />
        <ProjectsTracker projects={projects} isPending={isPending} searchRef={search} />
      </div>
    </HomeShell>
  )
}
