import { useId, useState, type KeyboardEvent } from 'react'
import { LIMITS } from '../../../domain/project'
import { cn, FieldError } from '../ds'
import { Cancel01Icon } from '../ds/icons'
import { Icon } from '../ds/Icon'

interface SkillsFieldProps {
  label: string
  skills: string[]
  onChange: (skills: string[]) => void
  /** Errors by skill index ("members[0].skills[2]" → 2). */
  errors?: Record<number, string>
  /** "inset" inside a card or a dialog, where a surface field would vanish. */
  fill?: 'surface' | 'inset'
}

/** Skills as chips: type one and press Enter or a comma. */
export function SkillsField({ label, skills, onChange, errors = {}, fill = 'surface' }: SkillsFieldProps) {
  const [text, setText] = useState('')
  const id = useId()
  const errorList = Object.entries(errors)

  const add = () => {
    const skill = text.trim().replace(/,$/, '').trim()
    if (skill && !skills.some((s) => s.toLowerCase() === skill.toLowerCase())) onChange([...skills, skill])
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add()
    } else if (event.key === 'Backspace' && !text && skills.length) {
      onChange(skills.slice(0, -1))
    }
  }

  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-control-md flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
          fill === 'surface' ? 'bg-surface' : 'bg-inset',
          errorList.length > 0 && 'shadow-[inset_0_0_0_1.5px_var(--coral)]',
        )}
      >
        {skills.map((skill, i) => (
          <span key={skill} className={cn('inline-flex h-7 items-center gap-1 rounded-pill pr-1 pl-3 text-label', errors[i] ? 'bg-coral-soft text-coral' : fill === 'surface' ? 'bg-surface-strong text-ink' : 'bg-surface text-ink')}>
            {skill}
            <button
              type="button"
              aria-label={`Quitar ${skill}`}
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              className="inline-flex size-5 items-center justify-center rounded-pill text-ink-muted hover:text-ink"
            >
              <Icon icon={Cancel01Icon} size={16} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          maxLength={LIMITS.skill + 10}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={skills.length ? '' : 'React, Python'}
          aria-invalid={errorList.length > 0 || undefined}
          className="h-7 min-w-24 flex-1 bg-transparent px-2 text-label font-normal outline-none"
        />
      </div>
      {errorList.map(([i, message]) => (
        <FieldError key={i}>
          {skills[Number(i)]}: {message}
        </FieldError>
      ))}
    </div>
  )
}
