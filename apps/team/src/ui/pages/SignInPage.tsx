import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { safeNext, withNext } from '../../application/session'
import { useToasts } from '../../application/toasts'
import { useSession } from '../../application/use-cases/useSession'
import type { FieldErrors } from '../../domain/rules'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button, FieldError, PasswordField, TextField, type IconGlyph } from '@agile/ui'
import { GithubIcon, GoogleIcon, Key01Icon, Login01Icon } from '@agile/ui/icons'

const PROVIDERS: { name: string; short: string; icon: IconGlyph }[] = [
  { name: 'Google', short: 'Google', icon: GoogleIcon },
  { name: 'GitHub', short: 'GitHub', icon: GithubIcon },
  { name: 'SSO', short: 'SSO', icon: Key01Icon },
]

/** "Continuar con…" buttons that only say they're coming (spec 015, FR-016). */
export function ProviderButtons() {
  const { push } = useToasts()
  return (
    <div className="grid gap-4">
      <span className="text-center text-label font-normal text-ink-muted">o</span>
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map((p) => (
          <Button key={p.name} icon={p.icon} size="lg" aria-label={`Continuar con ${p.name}`} className="px-3" onClick={() => push({ tone: 'info', message: 'Próximamente' })}>
            {p.short}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function SignInPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const { me, signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)

  if (me) return <Navigate to={safeNext(next)} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    const result = await signIn({ email, password })
    setSending(false)
    setErrors(result)
    if (Object.keys(result).length === 0) navigate(safeNext(next), { replace: true })
  }

  return (
    <AuthLayout
      title="Hola de nuevo"
      description="Entra con tu cuenta para seguir con tus proyectos."
      footer={<>¿No tienes cuenta? <Link to={withNext('/signup', next)} className="text-label text-accent-ink underline underline-offset-4">Crear cuenta</Link></>}
    >
      <form noValidate onSubmit={submit} className="grid gap-5">
        {errors[''] && <div role="alert"><FieldError>{errors['']}</FieldError></div>}
        <TextField
          label="Email"
          fill="surface"
          type="email"
          autoComplete="email"
          placeholder="ana@equipo.dev"
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrors({})
          }}
        />
        <PasswordField
          label="Contraseña"
          fill="surface"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrors({})
          }}
        />
        <Button type="submit" variant="primary" size="lg" icon={Login01Icon} loading={sending} className="mt-2 w-full">
          Iniciar sesión
        </Button>
      </form>
      <ProviderButtons />
    </AuthLayout>
  )
}
