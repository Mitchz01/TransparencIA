import type { Level, Methodology, StageKey, StageOutputs } from '../../../domain/plan'
import type { FieldErrors } from '../../../domain/rules'
import { NumberField, Select, TextArea, TextField } from '@agile/ui'
import { METHODOLOGY_NAMES } from './stageBodies'

// The leader's version of a stage: a few fields per stage, the rest of the content kept as the agent wrote it.
// adjust always sends the whole content (contract, ProposalGateway).

type Content = Record<string, unknown>

const COLUMN_NAMES = { todo: 'Por hacer', in_progress: 'En curso', review: 'En revisión' } as const
const LEVEL_NAMES: Record<Level, string> = { low: 'Baja', medium: 'Media', high: 'Alta' }
const LEVEL_OPTIONS = (['low', 'medium', 'high'] as Level[]).map((l) => ({ value: l, label: LEVEL_NAMES[l] }))

const asNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text))
const shown = (n: number) => (Number.isNaN(n) ? '' : String(n))
const whole = (n: number, low: number, high: number) => Number.isInteger(n) && n >= low && n <= high

/** Client checks before sending, keyed like the API's paths without "content.". */
export function validateAdjust(key: StageKey, content: Content): FieldErrors {
  const errors: FieldErrors = {}
  if (key === 'methodology') {
    const c = content as unknown as StageOutputs['methodology']
    if (!whole(c.sprint_length_weeks, 1, 8)) errors.sprint_length_weeks = 'Entre 1 y 8 semanas.'
    c.wip_limits.forEach((w, i) => !whole(w.limit, 1, 50) && (errors[`wip_limits[${i}].limit`] = 'Entre 1 y 50.'))
  }
  if (key === 'roadmap') {
    const c = content as unknown as StageOutputs['roadmap']
    c.phases.forEach((p, i) => {
      if (!p.name.trim()) errors[`phases[${i}].name`] = 'Obligatorio.'
      if (!whole(p.start_week, 1, 52)) errors[`phases[${i}].start_week`] = 'Entre 1 y 52.'
      if (!whole(p.end_week, 1, 52) || p.end_week < p.start_week) errors[`phases[${i}].end_week`] = 'Desde la semana de inicio hasta la 52.'
    })
  }
  if (key === 'backlog') {
    const c = content as unknown as StageOutputs['backlog']
    c.stories.forEach((s, i) => !whole(s.points, 0, 100) && (errors[`stories[${i}].points`] = 'Entre 0 y 100.'))
  }
  if (key === 'analysis' && !String(content.summary ?? '').trim()) errors.summary = 'Obligatorio.'
  if (key === 'architecture' && !String(content.style ?? '').trim()) errors.style = 'Obligatorio.'
  return errors
}

interface EditorProps<C> {
  content: C
  onChange: (content: C) => void
  errors: FieldErrors
}

function MethodologyEditor({ content, onChange, errors }: EditorProps<StageOutputs['methodology']>) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Metodología"
          value={content.methodology}
          options={Object.entries(METHODOLOGY_NAMES).map(([value, label]) => ({ value, label }))}
          onChange={(e) => onChange({ ...content, methodology: e.target.value as Methodology })}
        />
        <NumberField label="Duración de la iteración" unit="semanas" value={shown(content.sprint_length_weeks)} error={errors.sprint_length_weeks} onChange={(e) => onChange({ ...content, sprint_length_weeks: asNumber(e.target.value) })} />
      </div>
      {content.wip_limits.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {content.wip_limits.map((w, i) => (
            <NumberField
              key={w.column}
              label={`Límite WIP en ${COLUMN_NAMES[w.column]}`}
              unit="tareas"
              value={shown(w.limit)}
              error={errors[`wip_limits[${i}].limit`]}
              onChange={(e) => onChange({ ...content, wip_limits: content.wip_limits.map((x, j) => (j === i ? { ...x, limit: asNumber(e.target.value) } : x)) })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RoadmapEditor({ content, onChange, errors }: EditorProps<StageOutputs['roadmap']>) {
  const setPhase = (i: number, change: Partial<StageOutputs['roadmap']['phases'][number]>) =>
    onChange({ ...content, phases: content.phases.map((p, j) => (j === i ? { ...p, ...change } : p)) })
  return (
    <ul className="grid gap-3">
      {content.phases.map((p, i) => (
        <li key={i} className="grid gap-4 rounded-md bg-inset p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <TextField label="Fase" size="md" fill="surface" value={p.name} error={errors[`phases[${i}].name`]} onChange={(e) => setPhase(i, { name: e.target.value })} />
          <NumberField label="Semana de inicio" size="md" fill="surface" value={shown(p.start_week)} error={errors[`phases[${i}].start_week`]} onChange={(e) => setPhase(i, { start_week: asNumber(e.target.value) })} />
          <NumberField label="Semana de fin" size="md" fill="surface" value={shown(p.end_week)} error={errors[`phases[${i}].end_week`]} onChange={(e) => setPhase(i, { end_week: asNumber(e.target.value) })} />
        </li>
      ))}
    </ul>
  )
}

function BacklogEditor({ content, onChange, errors }: EditorProps<StageOutputs['backlog']>) {
  const setStory = (i: number, change: Partial<StageOutputs['backlog']['stories'][number]>) =>
    onChange({ ...content, stories: content.stories.map((s, j) => (j === i ? { ...s, ...change } : s)) })
  return (
    <ul className="grid gap-2">
      {content.stories.map((s, i) => (
        <li key={s.key} className="grid items-center gap-3 rounded-md bg-inset p-3 sm:grid-cols-[minmax(0,1fr)_120px_150px] sm:pl-4">
          <span className="flex min-w-0 gap-2 text-label">
            <span className="text-key text-ink-muted">{s.key}</span>
            <span className="truncate">{s.title}</span>
          </span>
          <NumberField label={`Puntos de ${s.key}`} hideLabel size="md" fill="surface" unit="pts" value={shown(s.points)} error={errors[`stories[${i}].points`]} onChange={(e) => setStory(i, { points: asNumber(e.target.value) })} />
          <Select label={`Prioridad de ${s.key}`} hideLabel size="md" fill="surface" value={s.priority} options={LEVEL_OPTIONS} onChange={(e) => setStory(i, { priority: e.target.value as Level })} />
        </li>
      ))}
    </ul>
  )
}

function SprintsEditor({ content, onChange }: EditorProps<StageOutputs['sprints']>) {
  const keys = content.sprints.flatMap((s) => s.story_keys)
  const sprintOf = (key: string) => content.sprints.find((s) => s.story_keys.includes(key))?.number ?? content.sprints[0]?.number
  const move = (key: string, number: number) =>
    onChange({
      ...content,
      sprints: content.sprints.map((s) => ({
        ...s,
        story_keys: s.number === number ? [...s.story_keys.filter((k) => k !== key), key] : s.story_keys.filter((k) => k !== key),
      })),
    })
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {keys.map((key) => (
        <li key={key} className="flex items-center justify-between gap-3 rounded-md bg-inset py-2 pr-2 pl-4">
          <span className="text-key">{key}</span>
          <Select
            label={`Sprint de ${key}`}
            hideLabel
            size="md"
            fill="surface"
            className="w-40"
            value={String(sprintOf(key))}
            options={content.sprints.map((s) => ({ value: String(s.number), label: s.name }))}
            onChange={(e) => move(key, Number(e.target.value))}
          />
        </li>
      ))}
    </ul>
  )
}

function AnalysisEditor({ content, onChange, errors }: EditorProps<StageOutputs['analysis']>) {
  return (
    <div className="grid gap-5">
      <TextArea label="Resumen" value={content.summary} error={errors.summary} onChange={(e) => onChange({ ...content, summary: e.target.value })} />
      <Select label="Complejidad" className="sm:max-w-xs" value={content.complexity} options={LEVEL_OPTIONS} onChange={(e) => onChange({ ...content, complexity: e.target.value as Level })} />
    </div>
  )
}

function ArchitectureEditor({ content, onChange, errors }: EditorProps<StageOutputs['architecture']>) {
  return (
    <div className="grid gap-5">
      <TextField label="Estilo" value={content.style} error={errors.style} onChange={(e) => onChange({ ...content, style: e.target.value })} />
      <TextArea label="Resumen" value={content.summary} onChange={(e) => onChange({ ...content, summary: e.target.value })} />
    </div>
  )
}

export function AdjustEditor({ stageKey, ...props }: { stageKey: StageKey } & EditorProps<Content>) {
  const p = <K extends StageKey>() => props as unknown as EditorProps<StageOutputs[K]>
  switch (stageKey) {
    case 'analysis': return <AnalysisEditor {...p<'analysis'>()} />
    case 'methodology': return <MethodologyEditor {...p<'methodology'>()} />
    case 'architecture': return <ArchitectureEditor {...p<'architecture'>()} />
    case 'roadmap': return <RoadmapEditor {...p<'roadmap'>()} />
    case 'backlog': return <BacklogEditor {...p<'backlog'>()} />
    case 'sprints': return <SprintsEditor {...p<'sprints'>()} />
  }
}
