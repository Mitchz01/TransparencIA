import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useProjects } from '../../application/use-cases/useProjects'
import { useMe } from '../../application/use-cases/useSession'
import { firstName, recentProjects } from '../../domain/launchpad'
import { AgentsPill } from '../components/home/AgentsPill'
import { MeshHero } from '../components/home/MeshHero'
import { ProjectComposer, type ComposerHandle } from '../components/home/ProjectComposer'
import { ProjectsPanel } from '../components/home/ProjectsPanel'
import { HomeShell, type HomeIntent } from '../components/shell/HomeShell'

const PANEL_ID = 'proyectos'

const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

/** The home (spec 016): a living hero where you describe a project, and your projects in a panel over its bottom. */
export function ProjectsPage() {
  const { data: projects, isPending } = useProjects()
  const { data: me } = useMe()
  const location = useLocation()
  const composer = useRef<ComposerHandle>(null)
  const search = useRef<HTMLInputElement>(null)
  const name = firstName(me?.name)
  const latest = recentProjects(projects ?? [], 1)[0]

  const onIntent = useCallback((intent: HomeIntent) => {
    if (intent === 'composer') {
      composer.current?.focus()
      window.scrollTo({ top: 0, behavior: scrollBehavior() })
      return
    }
    document.getElementById(PANEL_ID)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    if (intent === 'search') search.current?.focus({ preventScroll: true })
  }, [])

  const fill = useCallback((description: string) => {
    composer.current?.fill(description)
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
  }, [])

  // Arriving from another screen's sidebar with something to do here.
  const focus = (location.state as { focus?: HomeIntent } | null)?.focus
  useEffect(() => {
    if (focus) onIntent(focus)
  }, [focus, onIntent])

  return (
    <HomeShell active="projects" onIntent={onIntent}>
      <div className="relative isolate overflow-hidden rounded-xl">
        <MeshHero />
        <section
          aria-labelledby="home-greeting"
          className="pointer-events-none relative z-10 flex min-h-[min(78svh,760px)] flex-col items-center justify-center gap-6 px-4 pt-12 pb-[168px] text-center sm:gap-8 sm:px-8 [&>*]:pointer-events-auto"
        >
          <AgentsPill latestProjectId={latest?.id ?? null} onStart={() => composer.current?.focus()} />
          <h1 id="home-greeting" className="max-w-3xl text-display text-balance text-on-mesh md:text-[3rem]">
            {name ? `¿Qué proyecto levantamos hoy, ${name}?` : '¿Qué proyecto levantamos hoy?'}
          </h1>
          <ProjectComposer ref={composer} />
        </section>
        <div className="relative -mt-[120px] px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-[1200px]">
            <ProjectsPanel id={PANEL_ID} projects={projects} isPending={isPending} onTemplate={fill} searchRef={search} />
          </div>
        </div>
      </div>
    </HomeShell>
  )
}
