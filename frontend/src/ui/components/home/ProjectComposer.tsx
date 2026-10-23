import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { useNavigate } from 'react-router-dom'
import { REQUESTED_METHODOLOGIES, type RequestedMethodology } from '../../../domain/project'
import { PROJECT_DEFAULTS } from '../../../domain/rules'
import { buttonClasses, Icon, Menu } from '../ds'
import { ArrowUp02Icon, Clock01Icon, Route01Icon } from '../ds/icons'
import { METHODOLOGY_LABELS } from '../project/ProjectForm'

/** What `/projects/new` receives from the home (spec 016). */
export interface ProjectSeed {
  description: string
  methodology: RequestedMethodology
  duration: number
}

export interface ComposerHandle {
  focus: () => void
  /** Replaces the text (a template) and focuses the box at its end. */
  fill: (text: string) => void
}

const DURATIONS = [4, 6, 8, 12] as const

const EXAMPLES = [
  'Una app de citas para clínicas veterinarias…',
  'Un marketplace de artesanos de Medellín…',
  'Un SaaS de reservas para canchas de fútbol 5…',
]

const LINE = 24
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Types the examples out and erases them, one after another. Still under reduced motion or while there's text. */
function useTypewriter(active: boolean) {
  const [text, setText] = useState(EXAMPLES[0])
  useEffect(() => {
    if (!active || reducedMotion()) return
    // Starts from the first example in full, as it shows before moving.
    let example = 0
    let length = EXAMPLES[0].length
    let erasing = true
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const full = EXAMPLES[example]
      length += erasing ? -2 : 1
      setText(full.slice(0, Math.max(0, length)))
      let wait = erasing ? 22 : 55
      if (!erasing && length >= full.length) {
        erasing = true
        wait = 2200
      } else if (erasing && length <= 0) {
        erasing = false
        example = (example + 1) % EXAMPLES.length
        wait = 400
      }
      timer = setTimeout(tick, wait)
    }
    timer = setTimeout(tick, 2200)
    return () => clearTimeout(timer)
  }, [active])
  return active ? text : EXAMPLES[0]
}

/** The home's box: describe a project, pick a methodology and a duration, Enter opens the form prefilled.
 *  Never creates the project itself: your role may be required (spec 015). */
export function ProjectComposer({ ref }: { ref?: Ref<ComposerHandle> }) {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [methodology, setMethodology] = useState<RequestedMethodology>(PROJECT_DEFAULTS.requested_methodology)
  const [duration, setDuration] = useState<number>(PROJECT_DEFAULTS.duration_weeks)
  const box = useRef<HTMLTextAreaElement>(null)
  const placeholder = useTypewriter(description === '')

  useImperativeHandle(ref, () => ({
    focus: () => box.current?.focus({ preventScroll: true }),
    fill: (text: string) => {
      setDescription(text)
      requestAnimationFrame(() => {
        const node = box.current
        if (!node) return
        node.focus({ preventScroll: true })
        node.setSelectionRange(text.length, text.length)
      })
    },
  }), [])

  // Grows with the text from two to eight lines.
  useLayoutEffect(() => {
    const node = box.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(Math.max(node.scrollHeight, LINE * 2), LINE * 8)}px`
  }, [description])

  const empty = description.trim() === ''
  const send = () => {
    if (empty) return
    const seed: ProjectSeed = { description: description.trim(), methodology, duration }
    navigate('/projects/new', { state: seed })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form
      className="grid w-full max-w-[760px] gap-3 rounded-xl bg-surface/85 p-4 text-left text-ink shadow-float backdrop-blur-xl has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-focus sm:p-5"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <textarea
        ref={box}
        rows={2}
        value={description}
        aria-label="Describe tu proyecto"
        placeholder={placeholder}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={onKeyDown}
        className="block w-full resize-none bg-transparent px-1 text-body leading-6 text-ink outline-none focus-visible:outline-none placeholder:text-ink-muted"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Menu
          size="sm"
          icon={Route01Icon}
          label={`Metodología: ${METHODOLOGY_LABELS[methodology]}`}
          items={REQUESTED_METHODOLOGIES.map((m) => ({
            key: m,
            label: METHODOLOGY_LABELS[m],
            selected: m === methodology,
            onSelect: () => setMethodology(m),
          }))}
        >
          {METHODOLOGY_LABELS[methodology]}
        </Menu>
        <Menu
          size="sm"
          icon={Clock01Icon}
          label={`Duración: ${duration} semanas`}
          items={DURATIONS.map((weeks) => ({
            key: String(weeks),
            label: `${weeks} semanas`,
            selected: weeks === duration,
            onSelect: () => setDuration(weeks),
          }))}
        >
          <span className="tabular-nums">{duration} semanas</span>
        </Menu>
        <button
          type="submit"
          disabled={empty}
          aria-label="Continuar con este proyecto"
          className={buttonClasses('primary', 'md', 'ml-auto w-control-md px-0!')}
        >
          <Icon icon={ArrowUp02Icon} />
        </button>
      </div>
    </form>
  )
}
