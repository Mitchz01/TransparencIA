import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cn } from './cn'
import { FieldError } from './Field'

interface InlineTextProps {
  /** The accessible name; the text itself is what the person sees. */
  label: string
  value: string
  /** Called with the typed text when it changed. Return an error to keep the field open with it. */
  onCommit: (text: string) => string | void
  /** An error from the service for this field. */
  error?: string
  /** Enter adds a line; Ctrl or Cmd + Enter saves. */
  multiline?: boolean
  /** Wraps long text like `multiline`, but Enter saves (titles). */
  wrap?: boolean
  placeholder?: string
  unit?: string
  inputMode?: 'text' | 'numeric'
  className?: string
}

/**
 * Text that becomes a field on hover and focus (spec 011). It saves on Enter (single line), when the
 * field is left and when it goes away with unsaved text; Escape puts the saved value back.
 */
export function InlineText({ label, value, onCommit, error, multiline = false, wrap = false, placeholder, unit, inputMode, className }: InlineTextProps) {
  const [text, setText] = useState(value)
  const [localError, setLocalError] = useState<string>()
  const [focused, setFocused] = useState(false)
  const [shown, setShown] = useState(value)
  const errorId = useId()
  const shownError = localError ?? error

  // A new value from the service replaces the text, unless the person is typing.
  if (value !== shown) {
    setShown(value)
    if (!focused) setText(value)
  }

  // What the handlers and the unmount read; `sent` is the last text handed to onCommit.
  const latest = useRef({ text, value, onCommit, sent: value })
  useEffect(() => {
    latest.current = { ...latest.current, text, value, onCommit }
  })

  const commit = () => {
    const { text, value, sent } = latest.current
    if (text === value || text === sent) return
    const problem = latest.current.onCommit(text) || undefined
    setLocalError(problem)
    if (!problem) latest.current.sent = text
  }

  // Closing the panel while typing still saves (spec 011, FR-004).
  useEffect(
    () => () => {
      const { text, value, sent, onCommit } = latest.current
      if (text !== value && text !== sent) onCommit(text)
    },
    [],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      // The first Escape only leaves the field; the panel closes on the next one.
      event.stopPropagation()
      setText(value)
      latest.current.text = value
      setLocalError(undefined)
      event.currentTarget.blur()
    } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  const area = multiline || wrap
  const Tag = area ? 'textarea' : 'input'

  const field = (
    <Tag
      {...(area ? { rows: multiline ? 2 : 1 } : { type: 'text', inputMode })}
      aria-label={label}
      aria-invalid={shownError ? true : undefined}
      aria-describedby={shownError ? errorId : undefined}
      value={text}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onKeyDown={onKeyDown}
      onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setText(event.target.value)
        setLocalError(undefined)
      }}
      className={cn(
        'min-w-0 rounded-md bg-transparent px-3 py-1.5 text-ink transition-[background-color,box-shadow] duration-150 placeholder:text-ink-subtle',
        'hover:bg-inset focus:bg-inset focus-visible:outline-none',
        shownError && 'bg-inset shadow-[inset_0_0_0_1.5px_var(--coral)]',
        area && 'resize-none [field-sizing:content]',
        unit ? 'w-14 flex-none tabular-nums' : 'w-full',
        className,
      )}
    />
  )

  return (
    <div className="grid min-w-0 flex-1 gap-1">
      {unit ? (
        <span className="flex items-center gap-1">
          {field}
          <span className="text-label text-ink-muted">{unit}</span>
        </span>
      ) : (
        field
      )}
      {shownError && <FieldError id={errorId}>{shownError}</FieldError>}
    </div>
  )
}
