import { useNavigate } from 'react-router-dom'
import { AgentSpark, Button, Icon, Popover, type IconGlyph } from '@agile/ui'
import { ArrowRight02Icon, FlowchartIcon, GithubIcon, GoogleGeminiIcon, RefreshIcon, Route01Icon } from '@agile/ui/icons'

const ROWS: { icon: IconGlyph; title: string; text: string }[] = [
  { icon: Route01Icon, title: 'Planifican', text: 'Eligen la metodología, arman el roadmap y reparten el trabajo según tu equipo.' },
  { icon: FlowchartIcon, title: 'Escriben specs y diagramas', text: 'Cada historia llega con su spec y la arquitectura dibujada.' },
  { icon: RefreshIcon, title: 'Replanifican desde GitHub', text: 'Leen issues y pull requests, y proponen cambios cuando el plan se desvía.' },
]

const mark = 'inline-flex size-7 items-center justify-center rounded-sm ring-2 ring-mesh-5'

/** The pill above the greeting: what the agents do, and a way to connect GitHub (spec 016). */
export function AgentsPill({ latestProjectId, onStart }: { latestProjectId: number | null; onStart: () => void }) {
  const navigate = useNavigate()
  return (
    <Popover
      label="Qué hacen los agentes"
      chevron={false}
      buttonClassName="h-auto! min-h-control-md py-1! pr-4! pl-1! gap-3 bg-on-mesh/12! text-on-mesh! hover:bg-on-mesh/20! hover:opacity-100! backdrop-blur-md whitespace-normal text-left"
      trigger={
        <>
          <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
            <span className={`${mark} bg-primary text-on-primary`}><AgentSpark size={16} /></span>
            <span className={`${mark} bg-surface text-ink`}><Icon icon={GithubIcon} size={16} /></span>
            <span className={`${mark} bg-inverse text-on-inverse`}><Icon icon={GoogleGeminiIcon} size={16} /></span>
          </span>
          <span className="min-w-0">
            <span className="sm:hidden">Agentes con Gemini y GitHub</span>
            <span className="hidden sm:inline">Agentes con Gemini que planifican y sincronizan con GitHub</span>
          </span>
          <Icon icon={ArrowRight02Icon} className="shrink-0" />
        </>
      }
    >
      <div className="grid w-[min(360px,calc(100vw-56px))] gap-1">
        {ROWS.map((row) => (
          <div key={row.title} className="flex items-start gap-3 rounded-md p-2">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary-soft-ink">
              <Icon icon={row.icon} />
            </span>
            <span className="grid gap-0.5">
              <span className="text-label text-ink">{row.title}</span>
              <span className="text-caption text-ink-muted">{row.text}</span>
            </span>
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        icon={GithubIcon}
        className="w-full"
        onClick={() => (latestProjectId ? navigate(`/projects/${latestProjectId}/integrations`) : onStart())}
      >
        {latestProjectId ? 'Conectar GitHub' : 'Describe tu primer proyecto'}
      </Button>
    </Popover>
  )
}
