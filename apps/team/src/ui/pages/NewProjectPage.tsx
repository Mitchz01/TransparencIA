import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCreateProject } from '../../application/use-cases/useCreateProject'
import { useMe } from '../../application/use-cases/useSession'
import { ButtonLink, Icon } from '@agile/ui'
import { Add01Icon } from '@agile/ui/icons'
import type { ContractReading } from '../../domain/contracts'
import { ContractUpload } from '../components/project/ContractUpload'
import { ProjectForm } from '../components/project/ProjectForm'
import { emptyDraft, toProjectCreate, type ProjectDraft } from '../components/project/projectDraft'
import { TEMPLATES, type ProjectTemplate } from '../components/project/templates'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeShell } from '../components/shell/HomeShell'

/** Where the form's texts come from: an example, or what the AI read from the contract (spec 017, US7). */
type Source = { key: string; name: string; description: string; weeks: number | null }

const fromTemplate = (t: ProjectTemplate): Source => ({ key: t.key, name: t.name, description: t.description, weeks: t.weeks })

let readings = 0
const fromContract = (r: ContractReading): Source => ({
  key: `contract-${++readings}`,
  name: r.name ?? '',
  description: r.description ?? r.purpose ?? '',
  weeks: r.duration_weeks,
})

function draftFrom(profileRole: string | null, source: Source | null): ProjectDraft {
  const draft = emptyDraft(profileRole)
  if (!source) return draft
  return { ...draft, name: source.name, description: source.description, duration: source.weeks ? String(source.weeks) : draft.duration }
}

/** Public projects to start from: one click fills the form, everything stays editable (spec 019). */
function Examples({ chosen, onPick }: { chosen: string | null; onPick: (template: ProjectTemplate) => void }) {
  return (
    <section aria-label="Empezar desde un ejemplo" className="grid gap-3 pb-3">
      <h2 className="text-label text-ink-muted">Empezar desde un ejemplo</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <li key={template.key} className="grid">
            <button
              type="button"
              aria-pressed={chosen === template.key}
              onClick={() => onPick(template)}
              className="flex items-start gap-3 rounded-lg bg-surface p-4 text-left transition-[background-color] duration-150 hover:bg-surface-strong aria-pressed:bg-primary-soft aria-pressed:text-primary-soft-ink"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-inset">
                <Icon icon={template.icon} />
              </span>
              <span className="grid gap-0.5">
                <span className="text-label">{template.name}</span>
                <span className="text-caption text-ink-muted">{template.summary}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function NewProjectPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const profileRole = me?.role ?? null
  const [source, setSource] = useState<Source | null>(null)
  const { hash } = useLocation()
  // "Crear desde contrato" on the home lands on the upload.
  useEffect(() => {
    if (hash === '#contrato') document.getElementById('contrato')?.scrollIntoView({ block: 'start' })
  }, [hash])
  // Straight to the team, so the link to share is the first thing the leader sees.
  const create = useCreateProject(useCallback((id: number) => navigate(`/projects/${id}/team`), [navigate]))
  const roleField = profileRole ? 'optional' : 'required'

  return (
    <HomeShell active="new">
      <div className="mx-auto max-w-4xl px-1 pb-24 sm:px-5 lg:pt-5">
        <PageHeader
          title="Registrar proyecto"
          description="Cuenta qué se va a ejecutar, dónde y para quién. Los agentes arman el plan de trabajo por etapas y tú lo apruebas."
        />
        <div className="grid gap-3 pb-3">
          <ContractUpload onRead={(reading) => setSource(fromContract(reading))} />
        </div>
        <Examples chosen={source?.key ?? null} onPick={(template) => setSource(fromTemplate(template))} />
        <ProjectForm
          // A new example or contract starts the form over with its texts; what was typed by hand is replaced on purpose.
          key={source?.key ?? 'blank'}
          initial={draftFrom(profileRole, source)}
          roleField={roleField}
          submitLabel="Registrar proyecto"
          submitIcon={Add01Icon}
          onSubmit={(draft) => create(toProjectCreate(draft, roleField))}
          secondaryAction={<ButtonLink to="/" variant="quiet" size="lg">Cancelar</ButtonLink>}
        />
      </div>
    </HomeShell>
  )
}
