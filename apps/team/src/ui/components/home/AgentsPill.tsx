import { useNavigate } from 'react-router-dom'
import { AgentSpark, Button, Icon, Popover, type IconGlyph } from '@agile/ui'
import { AiMagicIcon, ArrowRight02Icon, Coins01Icon, GoogleGeminiIcon, Route01Icon, UserGroupIcon } from '@agile/ui/icons'

const ROWS: { icon: IconGlyph; title: string; text: string }[] = [
  { icon: Route01Icon, title: 'Planifican el contrato', text: 'Convierten el objeto y las obligaciones en fases y actividades, y reparten el trabajo según tu equipo.' },
  { icon: AiMagicIcon, title: 'Leen facturas y fotos', text: 'Asignan cada gasto a su rubro y su actividad, y marcan lo que no cuadra para que una persona lo revise.' },
  { icon: UserGroupIcon, title: 'Le responden al ciudadano', text: 'Explican en palabras sencillas en qué va el proyecto y en qué se gastó la plata.' },
]

const mark = 'inline-flex size-7 items-center justify-center rounded-sm ring-2 ring-mesh-5'

/** The pill above the greeting: what the agents do, and a way into the latest project's transparency (spec 016, spec 017 FR-023). */
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
            <span className={`${mark} bg-surface text-ink`}><Icon icon={Coins01Icon} size={16} /></span>
            <span className={`${mark} bg-inverse text-on-inverse`}><Icon icon={GoogleGeminiIcon} size={16} /></span>
          </span>
          <span className="min-w-0">
            <span className="sm:hidden">Agentes con Gemini</span>
            <span className="hidden sm:inline">Agentes con Gemini que planifican el contrato y rinden cuentas de cada peso</span>
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
        icon={Coins01Icon}
        className="w-full"
        onClick={() => (latestProjectId ? navigate(`/projects/${latestProjectId}/transparency`) : onStart())}
      >
        {latestProjectId ? 'Ver la transparencia' : 'Describe tu primer proyecto'}
      </Button>
    </Popover>
  )
}
