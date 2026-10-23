import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { withNext } from '../../application/session'
import { useSession } from '../../application/use-cases/useSession'
import { useInvitationPreview, useJoin } from '../../application/use-cases/useTeam'
import { LIMITS } from '../../domain/project'
import type { FieldErrors } from '../../domain/rules'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button, ButtonLink, Icon, Skeleton, TextField } from '../components/ds'
import { Alert02Icon, ArrowLeft01Icon, CrownIcon, Login01Icon, UserAdd01Icon } from '../components/ds/icons'

const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`)

/** /join/:token: who invites you and to what, then one button. Signed out, it sends you to sign in or up and back here (spec 015, US4). */
export function JoinPage() {
  const token = useParams().token ?? ''
  const preview = useInvitationPreview(token)
  const { me, isPending } = useSession()

  if (preview.invalid) {
    return (
      <AuthLayout title="Esta invitación ya no es válida" description="Pide al líder un link nuevo. Si ya eres parte del proyecto, lo encuentras en tus proyectos.">
        <div className="flex items-center gap-3 rounded-lg bg-surface p-5">
          <Icon icon={Alert02Icon} className="text-coral" />
          <p className="text-body">El link se cambió o las invitaciones están desactivadas.</p>
        </div>
        <ButtonLink to="/" icon={ArrowLeft01Icon} size="lg">Ir a mis proyectos</ButtonLink>
      </AuthLayout>
    )
  }

  if (!preview.data || isPending) {
    return (
      <AuthLayout title="Abriendo la invitación">
        <div className="grid gap-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </AuthLayout>
    )
  }

  const { project_name, leaders, already_member } = preview.data
  const invitation = (
    <div className="grid gap-1 rounded-lg bg-surface p-5">
      <p className="text-heading">Te invitaron a {project_name}</p>
      <p className="inline-flex items-center gap-2 text-body text-ink-muted">
        <Icon icon={CrownIcon} size={16} />
        Líder: {listNames(leaders)}
      </p>
    </div>
  )

  if (!me) {
    const here = `/join/${token}`
    return (
      <AuthLayout title="Únete al proyecto" description="Inicia sesión o crea tu cuenta. Después vuelves aquí y entras con un botón.">
        {invitation}
        <div className="grid gap-2 sm:grid-cols-2">
          <ButtonLink to={withNext('/signup', here)} variant="primary" size="lg" icon={UserAdd01Icon}>Crear cuenta</ButtonLink>
          <ButtonLink to={withNext('/login', here)} size="lg" icon={Login01Icon}>Iniciar sesión</ButtonLink>
        </div>
      </AuthLayout>
    )
  }

  return <JoinForm token={token} invitation={invitation} alreadyMember={already_member} profileRole={me.role ?? ''} />
}

function JoinForm({ token, invitation, alreadyMember, profileRole }: { token: string; invitation: ReactNode; alreadyMember: boolean; profileRole: string }) {
  const navigate = useNavigate()
  const join = useJoin(token)
  const [role, setRole] = useState(profileRole)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)

  // Opening the link again changes nothing: straight to the project.
  if (alreadyMember) return <JoinRedirect token={token} />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = role.trim()
    if (!clean) return setErrors({ role: 'Dinos qué vas a hacer en este proyecto.' })
    if (clean.length > LIMITS.role) return setErrors({ role: `Máximo ${LIMITS.role} caracteres.` })
    setSending(true)
    const result = await join(clean)
    setSending(false)
    if ('projectId' in result) navigate(`/projects/${result.projectId}/board`, { replace: true })
    else setErrors(result.errors)
  }

  return (
    <AuthLayout title="Únete al proyecto" description="Entras como miembro con los datos de tu perfil. El líder puede ajustarlos después.">
      {invitation}
      <form noValidate onSubmit={submit} className="grid gap-5">
        <TextField
          label="Tu rol en este proyecto"
          fill="surface"
          placeholder="Frontend"
          value={role}
          error={errors.role}
          hint={profileRole ? 'Viene de tu perfil. Cámbialo si aquí haces otra cosa.' : undefined}
          onChange={(e) => {
            setRole(e.target.value)
            setErrors({})
          }}
        />
        <Button type="submit" variant="primary" size="lg" icon={UserAdd01Icon} loading={sending} className="w-full">
          Unirme
        </Button>
      </form>
      <p className="text-center text-body text-ink-muted">
        <Link to="/" className="text-label text-accent-ink underline underline-offset-4">Ahora no</Link>
      </p>
    </AuthLayout>
  )
}

/** Already a member: joining again answers with the project without changing anything. */
function JoinRedirect({ token }: { token: string }) {
  const join = useJoin(token)
  const [target, setTarget] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void join('').then((result) => live && setTarget('projectId' in result ? `/projects/${result.projectId}/board` : '/'))
    return () => {
      live = false
    }
  }, [join])
  if (target) return <Navigate to={target} replace />
  return <div className="min-h-svh bg-bg" />
}
