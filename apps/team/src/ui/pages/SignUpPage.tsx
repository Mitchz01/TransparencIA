import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { safeNext, withNext } from '../../application/session'
import { EMAIL_TAKEN, useSession } from '../../application/use-cases/useSession'
import { ACCOUNT_LIMITS } from '../../domain/account'
import type { FieldErrors } from '../../domain/rules'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button, FieldError, PasswordField, TextField } from '@agile/ui'
import { UserAdd01Icon } from '@agile/ui/icons'
import { ProviderButtons } from './SignInPage'

export function SignUpPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const { me, signUp } = useSession()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  // Signing up signs you in; only someone who arrived already signed in is sent on.
  const [creating, setCreating] = useState(false)

  if (me && !creating) return <Navigate to={safeNext(next)} replace />

  const change = (field: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors(({ [field]: _gone, ...rest }) => rest)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setCreating(true)
    const result = await signUp(form)
    setSending(false)
    setErrors(result)
    if (Object.keys(result).length) {
      setCreating(false)
      return
    }
    // The profile step comes next, then wherever the person was going.
    navigate(withNext('/welcome', next), { replace: true })
  }

  const signInLink = <Link to={withNext('/login', next)} className="text-label text-accent-ink underline underline-offset-4">Iniciar sesión</Link>

  return (
    <AuthLayout
      title="Crear cuenta"
      description="Con tu cuenta creas proyectos o te unes a los de tu equipo con un link."
      footer={<>¿Ya tienes cuenta? {signInLink}</>}
    >
      <form noValidate onSubmit={submit} className="grid gap-5">
        {errors[''] && <FieldError>{errors['']}</FieldError>}
        <TextField label="Nombre" fill="surface" autoComplete="name" placeholder="Ana Gómez" value={form.name} error={errors.name} onChange={(e) => change('name')(e.target.value)} />
        <div className="grid gap-2">
          <TextField label="Email" fill="surface" type="email" autoComplete="email" placeholder="ana@equipo.dev" value={form.email} error={errors.email} onChange={(e) => change('email')(e.target.value)} />
          {errors.email === EMAIL_TAKEN && <span className="text-caption text-ink-muted">¿Es tuya? {signInLink}</span>}
        </div>
        <PasswordField
          label="Contraseña"
          fill="surface"
          autoComplete="new-password"
          hint={`Al menos ${ACCOUNT_LIMITS.password[0]} caracteres.`}
          value={form.password}
          error={errors.password}
          onChange={(e) => change('password')(e.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" icon={UserAdd01Icon} loading={sending} className="mt-2 w-full">
          Crear cuenta
        </Button>
      </form>
      <ProviderButtons />
    </AuthLayout>
  )
}
