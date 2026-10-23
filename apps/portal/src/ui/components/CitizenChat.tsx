// Spec 017, US4. Owner: P5. A citizen asks, the AI answers only from the portal's data (FR-013).
import { Button, Card, Chip, TextField } from '@agile/ui'
import { AiMagicIcon } from '@agile/ui/icons'
import { useState } from 'react'
import { isApiError } from '../../application/errors'
import { useAskCitizen } from '../../application/useAskCitizen'

const SUGGESTED = ['¿En qué se gastaron la plata?', '¿Cuánto falta por ejecutar?', '¿Qué se ha sembrado?']
const QUESTION_MAX = 300

interface Turn {
  question: string
  answer: string
}

export function CitizenChat({ slug }: { slug: string }) {
  const ask = useAskCitizen(slug)
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')

  const send = (text: string) => {
    const q = text.trim()
    if (!q || ask.isPending) return
    ask.mutate(q, {
      onSuccess: ({ answer }) => {
        setTurns((previous) => [...previous, { question: q, answer }])
        setQuestion('')
      },
    })
  }

  const failed = ask.isError
    ? isApiError(ask.error) && ask.error.code === 'agent_unavailable'
      ? 'El asistente no está disponible; los datos de arriba están completos.'
      : 'No pudimos enviar la pregunta. Inténtalo de nuevo.'
    : null

  return (
    <Card className="grid gap-4">
      {turns.length > 0 && (
        <ol className="grid gap-3" aria-live="polite">
          {turns.map((turn, i) => (
            <li key={i} className="grid gap-2">
              <p className="justify-self-end rounded-md bg-primary px-4 py-2 text-body text-on-primary">{turn.question}</p>
              <p className="justify-self-start rounded-md bg-inset px-4 py-2 text-body">{turn.answer}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((suggested) => (
          <Chip key={suggested} pressed={false} inset disabled={ask.isPending} onClick={() => send(suggested)}>
            {suggested}
          </Chip>
        ))}
      </div>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          send(question)
        }}
      >
        <TextField
          label="Tu pregunta"
          maxLength={QUESTION_MAX}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          error={failed ?? undefined}
        />
        <Button type="submit" icon={AiMagicIcon} loading={ask.isPending} disabled={!question.trim()} className="justify-self-start">
          Preguntar
        </Button>
      </form>
    </Card>
  )
}
