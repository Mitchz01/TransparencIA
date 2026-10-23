import { useNavigate, useSearchParams } from 'react-router-dom'
import { safeNext } from '../../application/session'
import { useSession } from '../../application/use-cases/useSession'
import { ProfileForm } from '../components/account/ProfileForm'
import { PROFILE_HINT } from '../components/account/profileLabels'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button, ButtonLink } from '../components/ds'
import { ArrowRight01Icon, Tick02Icon } from '../components/ds/icons'
import { AppLayout } from '../components/shell/AppLayout'
import { PageHeader } from '../components/shell/PageHeader'
import { HomeTopBar } from '../components/shell/TopBar'

/** Right after signing up: one short step, every field with a default, skippable (spec 015, US2). */
export function WelcomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { me, updateProfile } = useSession()
  const next = safeNext(params.get('next'))
  const go = () => navigate(next, { replace: true })
  if (!me) return null

  return (
    <AuthLayout title="Cuéntanos qué haces" description={`Cada proyecto al que te unas toma estos datos, así nadie los escribe por ti. ${PROFILE_HINT}`}>
      <ProfileForm
        account={me}
        submitLabel="Guardar y seguir"
        submitIcon={ArrowRight01Icon}
        onSubmit={updateProfile}
        onDone={go}
        secondaryAction={<Button variant="quiet" size="lg" onClick={go}>Omitir</Button>}
      />
    </AuthLayout>
  )
}

/** The same profile, later, from the account menu. Changes don't touch the projects you already joined, except the name. */
export function ProfilePage() {
  const navigate = useNavigate()
  const { me, updateProfile } = useSession()
  if (!me) return null

  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mi perfil" description="Lo que llevas a cada proyecto nuevo. En los proyectos donde ya estás, tu rol y tus horas los decide el líder." />
        <ProfileForm
          key={me.id}
          account={me}
          withName
          submitLabel="Guardar cambios"
          submitIcon={Tick02Icon}
          onSubmit={updateProfile}
          onDone={() => navigate('/')}
          secondaryAction={<ButtonLink to="/" variant="quiet" size="lg">Cancelar</ButtonLink>}
        />
      </div>
    </AppLayout>
  )
}
