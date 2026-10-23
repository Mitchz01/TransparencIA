import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from './cn'
import { Icon, type IconGlyph } from './Icon'
import { Loading03Icon } from './icons'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'bg-surface-strong text-ink hover:opacity-80',
  quiet: 'bg-transparent text-ink-muted hover:bg-surface-strong hover:text-ink',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-4',
  md: 'h-control-md px-5',
  lg: 'h-control-lg px-6',
}

export const buttonClasses = (variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-pill text-label whitespace-nowrap transition-[color,background-color,opacity] duration-150',
    'disabled:opacity-50 disabled:hover:opacity-50 aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconGlyph
  /** Keeps the label and shows the action is running; the button can't be pressed again. */
  loading?: boolean
  children: ReactNode
}

export function Button({ variant, size, icon, loading = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Icon icon={Loading03Icon} className="animate-spin" /> : icon && <Icon icon={icon} />}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconGlyph
}

export function ButtonLink({ variant, size, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, typeof className === 'string' ? className : undefined)} {...rest}>
      {icon && <Icon icon={icon} />}
      {children}
    </Link>
  )
}
