// Spec 017, US4. Owner: P5. A citizen asks, the AI answers only from the portal's data (FR-013): a conversation
// with the project, suggestions to start, and a plain reminder of where the answers come from.
import { AgentSpark, cn, Icon, IconButton } from '@agile/ui'
import { ArrowRight02Icon, ArrowUp02Icon, Cancel01Icon, Loading03Icon } from '@agile/ui/icons'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isApiError } from '../../application/errors'
import { useAskCitizen } from '../../application/useAskCitizen'

const SUGGESTED = ['¿En qué se gastaron la plata?', '¿Qué se ha hecho hasta ahora?', '¿Qué falta por hacer?', '¿Hay algo en revisión?']
const QUESTION_MAX = 300

interface Turn {
  question: string
  answer: string | null // null while the assistant is answering
  failed?: string
}

interface CitizenChatProps {
  slug: string
  /** When given, the chat is a panel with a close button (the floating launcher). */
  onClose?: () => void
  /** Focus the question box when the panel opens. */
  autoFocus?: boolean
  className?: string
}

export function CitizenChat({ slug, onClose, autoFocus, className }: CitizenChatProps) {
  const ask = useAskCitizen(slug)
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [turns])

  useEffect(() => {
    if (autoFocus) input.current?.focus()
  }, [autoFocus])

  const send = (text: string) => {
    const q = text.trim()
    if (!q || ask.isPending) return
    setTurns((previous) => [...previous, { question: q, answer: null }])
    setQuestion('')
    ask.mutate(q, {
      onSuccess: ({ answer }) => setTurns((previous) => previous.map((turn, i) => (i === previous.length - 1 ? { ...turn, answer } : turn))),
      onError: (error) => {
        const failed =
          isApiError(error) && error.code === 'agent_unavailable'
            ? 'El asistente no está disponible ahora. Los datos de esta página están completos.'
            : 'No pudimos enviar la pregunta. Inténtalo de nuevo.'
        setTurns((previous) => previous.map((turn, i) => (i === previous.length - 1 ? { ...turn, failed } : turn)))
      },
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(question)
  }

  const asked = new Set(turns.map((turn) => turn.question))
  const left = SUGGESTED.filter((suggested) => !asked.has(suggested))

  return (
    <section aria-labelledby="chat-title" className={cn('grid grid-rows-[auto_minmax(0,1fr)_auto] gap-4 rounded-lg bg-surface p-5', className)}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
          <AgentSpark size={20} />
        </span>
        <div className="grid flex-1 gap-0.5">
          <h2 id="chat-title" className="text-heading">
            Pregúntale al proyecto
          </h2>
          <p className="text-caption text-ink-muted">Responde solo con los datos publicados en esta página.</p>
        </div>
        {onClose && <IconButton icon={Cancel01Icon} label="Cerrar el chat" variant="quiet" tooltip="none" onClick={onClose} />}
      </div>

      <div ref={log} aria-live="polite" className="grid min-h-0 content-start gap-4 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <p className="rounded-lg rounded-tl-sm bg-inset px-4 py-3 text-body">
            Hola. Puedes preguntarme en qué se ha gastado la plata, qué actividades se han hecho, qué falta o qué está en revisión.
            Te respondo con lo que el ejecutor reportó y las reglas calcularon.
          </p>
        )}
        {turns.length > 0 && (
          <ol className="grid gap-3">
            {turns.map((turn, i) => (
              <li key={i} className="grid gap-2">
                <p className="max-w-[85%] justify-self-end rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-body text-on-primary">{turn.question}</p>
                <div className="flex max-w-[92%] items-start gap-2 justify-self-start">
                  <span aria-hidden="true" className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-sm bg-inset text-ink">
                    <AgentSpark size={14} />
                  </span>
                  {turn.failed ? (
                    <p className="rounded-lg rounded-tl-sm bg-coral-soft px-4 py-2.5 text-body text-coral">{turn.failed}</p>
                  ) : turn.answer === null ? (
                    <p className="inline-flex items-center gap-2 rounded-lg rounded-tl-sm bg-inset px-4 py-2.5 text-body text-ink-muted">
                      <Icon icon={Loading03Icon} size={16} className="animate-spin" />
                      Revisando los datos del proyecto
                    </p>
                  ) : (
                    <p className="rounded-lg rounded-tl-sm bg-inset px-4 py-2.5 text-body">{turn.answer}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {left.length > 0 && (
          <ul className="grid gap-2" aria-label="Preguntas sugeridas">
            {left.slice(0, turns.length === 0 ? 4 : 2).map((suggested) => (
              <li key={suggested}>
                <button
                  type="button"
                  disabled={ask.isPending}
                  onClick={() => send(suggested)}
                  className="flex w-full items-center justify-between gap-3 rounded-md bg-inset px-4 py-3 text-left text-label text-ink transition-colors hover:bg-surface-strong disabled:opacity-50"
                >
                  {suggested}
                  <Icon icon={ArrowRight02Icon} size={16} className="shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 rounded-pill bg-inset py-1.5 pr-1.5 pl-5">
        <label htmlFor="citizen-question" className="sr-only">
          Tu pregunta
        </label>
        <input
          ref={input}
          id="citizen-question"
          value={question}
          maxLength={QUESTION_MAX}
          placeholder="Escribe tu pregunta"
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-body text-ink placeholder:text-ink-subtle focus:outline-none"
        />
        <IconButton
          type="submit"
          icon={ask.isPending ? Loading03Icon : ArrowUp02Icon}
          label="Preguntar"
          variant="inverse"
          tooltip="none"
          disabled={!question.trim() || ask.isPending}
          className={cn(ask.isPending && '[&_svg]:animate-spin')}
        />
      </form>
    </section>
  )
}
