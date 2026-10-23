import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlanViews } from '../../application/use-cases/usePlanViews'
import type { StageView } from '../../domain/planViews'
import { Segmented, SkeletonCard } from '../components/ds'
import { ArchitectureView } from '../components/plan/ArchitectureView'
import { MethodologyView } from '../components/plan/MethodologyView'
import { RoadmapTimeline } from '../components/plan/RoadmapTimeline'
import { ViewNotReady, ViewOrigin } from '../components/plan/ViewOrigin'
import { PageHeader } from '../components/shell/PageHeader'
import { TopBarViews } from '../components/shell/TopBarViews'
import { useCurrentProject } from './ProjectLayout'

type PlanPart = 'roadmap' | 'methodology' | 'architecture'

const PARTS: { value: PlanPart; label: string; description: string }[] = [
  { value: 'roadmap', label: 'Roadmap', description: 'Las fases en el tiempo y el avance de cada épica.' },
  { value: 'methodology', label: 'Metodología', description: 'Cómo trabaja el equipo y por qué.' },
  { value: 'architecture', label: 'Arquitectura', description: 'Cómo se arma el sistema y qué se decidió.' },
]

export function PlanPage() {
  const project = useCurrentProject()
  const { data: views, isPending } = usePlanViews(project.id)
  const [params, setParams] = useSearchParams()
  const part = PARTS.find((p) => p.value === params.get('view')) ?? PARTS[0]

  const body = (view: StageView<unknown> | undefined, content: ReactNode) => {
    if (!view) return null
    if (view.status !== 'approved') return <ViewNotReady projectId={project.id} stage={part.value} status={view.status} />
    return (
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="min-w-0">{content}</div>
        {view.origin && (
          <div className="lg:sticky lg:top-24">
            <ViewOrigin stage={part.value} origin={view.origin} />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <TopBarViews>
        <Segmented
          label="Parte del plan"
          value={part.value}
          options={PARTS.map(({ value, label }) => ({ value, label }))}
          onChange={(view) => setParams({ view }, { replace: true })}
        />
      </TopBarViews>
      <PageHeader title={part.label} description={part.description} />
      {isPending || !views ? (
        <SkeletonCard lines={6} />
      ) : part.value === 'roadmap' ? (
        body(views.roadmap, views.roadmap.content && <RoadmapTimeline roadmap={views.roadmap.content} />)
      ) : part.value === 'methodology' ? (
        body(views.methodology, views.methodology.content && <MethodologyView view={views.methodology.content} />)
      ) : (
        body(views.architecture, views.architecture.content && <ArchitectureView architecture={views.architecture.content} />)
      )}
    </>
  )
}
