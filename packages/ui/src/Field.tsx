import {
  useId, useState, type ComponentProps, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { cn } from './cn'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { Alert02Icon, ArrowDown01Icon, Tick02Icon, ViewIcon, ViewOffIcon } from './icons'

// Every field: a label above, an optional hint, and the error under the field with the typed value kept
// (spec 009, FR-008). The error is wired with aria-invalid + aria-describedby.

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  /** Visually hidden label, for rows where the column already names the field. */
  hideLabel?: boolean
  className?: string
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

export function FieldShell({ label, hint, error, hideLabel = false, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid content-start gap-2', className)}>
      <label htmlFor={id} className={cn('text-label text-ink', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && <FieldError id={errorId!}>{error}</FieldError>}
      {hint && !error && (
        <span id={hintId} className="text-caption text-ink-muted">
          {hint}
        </span>
      )}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="inline-flex items-start gap-1.5 text-caption text-coral">
      <Icon icon={Alert02Icon} size={16} className="mt-px" />
      <span>{children}</span>
    </span>
  )
}

const control = (size: 'md' | 'lg', invalid: boolean, fill: 'inset' | 'surface' = 'inset') =>
  cn(
    'w-full min-w-0 rounded-pill px-5 text-label font-normal text-ink transition-[box-shadow] duration-150',
    fill === 'inset' ? 'bg-inset' : 'bg-surface',
    size === 'lg' ? 'h-control-lg' : 'h-control-md',
    invalid && 'shadow-[inset_0_0_0_1.5px_var(--coral)]',
    'disabled:opacity-60',
  )

type BaseProps = {
  label: string
  hint?: string
  error?: string
  hideLabel?: boolean
  className?: string
  size?: 'md' | 'lg'
  /** "surface" for fields inside an inset block, so they don't vanish into it. */
  fill?: 'inset' | 'surface'
}

export function TextField({ label, hint, error, hideLabel, className, size = 'lg', fill, ...input }: BaseProps & Omit<ComponentProps<'input'>, 'size'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={control(size, invalid, fill)} {...input} />
      )}
    </FieldShell>
  )
}

export function NumberField({
  label, hint, error, hideLabel, className, size = 'lg', unit, fill, ...input
}: BaseProps & { unit?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {({ id, describedBy, invalid }) => (
        <span className="relative block">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(control(size, invalid, fill), 'tabular-nums', unit && 'pr-16')}
            {...input}
          />
          {unit && <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-label text-ink-muted">{unit}</span>}
        </span>
      )}
    </FieldShell>
  )
}

/** A password with a button that shows it while typing; the value never leaves the field. */
export function PasswordField({ label, hint, error, hideLabel, className, size = 'lg', fill, ...input }: BaseProps & Omit<ComponentProps<'input'>, 'size' | 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {({ id, describedBy, invalid }) => (
        <span className="relative block">
          <input
            id={id}
            type={shown ? 'text' : 'password'}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(control(size, invalid, fill), 'pr-14')}
            {...input}
          />
          <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
            <IconButton
              icon={shown ? ViewOffIcon : ViewIcon}
              label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              variant="quiet"
              size="md"
              tooltip="none"
              onClick={() => setShown(!shown)}
            />
          </span>
        </span>
      )}
    </FieldShell>
  )
}

export function TextArea({ label, hint, error, hideLabel, className, rows = 4, ...input }: Omit<BaseProps, 'size'> & ComponentProps<'textarea'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full resize-y rounded-md bg-inset px-5 py-3 text-body text-ink transition-[box-shadow] duration-150',
            invalid && 'shadow-[inset_0_0_0_1.5px_var(--coral)]',
          )}
          {...input}
        />
      )}
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  label, hint, error, hideLabel, className, size = 'lg', options, fill, ...select
}: BaseProps & { options: SelectOption[] } & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {({ id, describedBy, invalid }) => (
        <span className="relative block">
          <select
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(control(size, invalid, fill), 'cursor-pointer appearance-none pr-12 disabled:cursor-not-allowed')}
            {...select}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Icon icon={ArrowDown01Icon} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted" />
        </span>
      )}
    </FieldShell>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  /** Line-through for done checklist items. */
  strike?: boolean
}

/** A 20px square with 6px corners; checked is `primary` with a tick. The label is always next to it. */
export function Checkbox({ label, strike = false, className, checked, ...input }: CheckboxProps) {
  return (
    <label className={cn('inline-flex cursor-pointer items-start gap-3 text-body', className)}>
      <span className="relative mt-0.5 inline-flex size-5 shrink-0">
        <input type="checkbox" checked={checked} className="peer absolute inset-0 cursor-pointer opacity-0" {...input} />
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-[6px] transition-[background-color] duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            checked ? 'bg-primary text-on-primary' : 'bg-surface-strong',
          )}
        >
          {checked && <Icon icon={Tick02Icon} size={16} />}
        </span>
      </span>
      <span className={cn(strike && checked && 'text-ink-muted line-through')}>{label}</span>
    </label>
  )
}
