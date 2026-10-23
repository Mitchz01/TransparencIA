import type { ReactNode } from 'react'
import { Brand, ThemeToggle } from '../shell/TopBar'
import { AuthShowcase } from './AuthShowcase'

interface AuthLayoutProps {
  title: string
  description?: ReactNode
  children: ReactNode
  /** Under the form, at the bottom of the column: the way to the other screen ("Crear cuenta"). */
  footer?: ReactNode
}

/** Sign in, sign up, the profile step and the join link: the form on the left, what the product does on the right.
 *  The one glow of the screen sits behind the form (dark theme only). Under 1024px only the form shows. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-svh bg-bg p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-3">
      <div className="relative flex min-h-[calc(100svh-24px)] flex-col px-3 py-4 sm:px-8 lg:px-14 lg:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[85%] bg-glow" />
        <header className="relative flex items-center justify-between gap-3">
          <Brand withName />
          <span className="lg:hidden">
            <ThemeToggle />
          </span>
        </header>
        <main id="main" className="relative flex flex-1 items-center py-12">
          <div className="mx-auto grid w-full max-w-[400px] gap-8">
            <div className="grid gap-2">
              <h1 className="text-title">{title}</h1>
              {description && <p className="text-body text-ink-muted">{description}</p>}
            </div>
            {children}
          </div>
        </main>
        {footer && <footer className="relative mx-auto w-full max-w-[400px] text-center text-body text-ink-muted">{footer}</footer>}
      </div>
      <div className="sticky top-3 hidden h-[calc(100svh-24px)] lg:block">
        <AuthShowcase />
      </div>
    </div>
  )
}
