import type { StageKey } from '../../../domain/plan'
import type { StageStep } from '../../../domain/stepper'
import { cn, StateLabel } from '../ds'
import { STAGE_LABELS } from './stageLabels'
import { STAGE_STATES } from './stageStates'

interface StageStepperProps {
  steps: StageStep[]
  selected: StageKey
  onSelect: (key: StageKey) => void
}

/** Six rows, one per stage: its name, its agent and its state as icon + word. No numbered circles, no lines between steps. */
export function StageStepper({ steps, selected, onSelect }: StageStepperProps) {
  return (
    <nav aria-label="Etapas de la planificación" className="rounded-lg bg-surface p-2 sm:p-3">
      <ol className="grid gap-1">
        {steps.map((step) => {
          const look = STAGE_STATES[step.state]
          const isSelected = step.key === selected
          return (
            <li key={step.key}>
              <button
                type="button"
                aria-current={isSelected ? 'step' : undefined}
                onClick={() => onSelect(step.key)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left transition-[background-color] duration-150',
                  isSelected ? 'bg-surface-strong' : 'hover:bg-inset',
                )}
              >
                <span className="grid min-w-0">
                  <span className="text-label text-ink">{STAGE_LABELS[step.key].name}</span>
                  <span className="truncate text-caption text-ink-muted">{STAGE_LABELS[step.key].agent}</span>
                </span>
                <StateLabel hue={look.hue} icon={look.icon} spin={look.spin}>
                  {look.label}
                </StateLabel>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
