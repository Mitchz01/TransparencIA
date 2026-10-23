import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCreateProject } from '../../application/use-cases/useCreateProject'
import { useMe } from '../../application/use-cases/useSession'
import { suggestProjectName } from '../../domain/launchpad'
import { REQUESTED_METHODOLOGIES } from '../../domain/project'
import { ButtonLink } from '@agile/ui'
import { Add01Icon } from '@agile/ui/icons'
import type { ProjectSeed } from '../components/home/ProjectComposer'
import { ProjectForm } from '../components/project/ProjectForm'
import { emptyDraft, toProjectCreate, type ProjectDraft } from '../components/project/projectDraft'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeShell } from '../components/shell/HomeShell'

/** What the home's box sent (spec 016), if it looks right. */
function readSeed(state: unknown): ProjectSeed | null {
  const seed = state as Partial<ProjectSeed> | null
  if (!seed || typeof seed.description !== 'string' || !seed.description.trim()) return null
  return {
    description: seed.description,
    methodology: REQUESTED_METHODOLOGIES.includes(seed.methodology!) ? seed.methodology! : 'auto',
    duration: Number.isInteger(seed.duration) ? seed.duration! : Number.NaN,
  }
}

function initialDraft(profileRole: string | null, seed: ProjectSeed | null): ProjectDraft {
  const draft = emptyDraft(profileRole)
  if (!seed) return draft
  return {
    ...draft,
    name: suggestProjectName(seed.description),
    description: seed.description,
    methodology: seed.methodology,
    duration: Number.isNaN(seed.duration) ? draft.duration : String(seed.duration),
  }
}

export function NewProjectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: me } = useMe()
  const profileRole = me?.role ?? null
  const [seed] = useState(() => readSeed(location.state))
  const [initial] = useState(() => initialDraft(profileRole, seed))
  const form = useRef<HTMLDivElement>(null)
  // Straight to the team, so the link to share is the first thing the leader sees.
  const create = useCreateProject(useCallback((id: number) => navigate(`/projects/${id}/team`), [navigate]))
  const roleField = profileRole ? 'optional' : 'required'

  // From the home: the description is there, so the name (suggested) is what to check next.
  useEffect(() => {
    if (seed) form.current?.querySelector('input')?.focus()
  }, [seed])

  return (
    <HomeShell active="new">
      <div ref={form} className="mx-auto max-w-4xl px-1 pb-24 sm:px-5 lg:pt-5">
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
    </HomeShell>
  )
}
