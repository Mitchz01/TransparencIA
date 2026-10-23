import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { safeNext } from '../../application/session'
import { useSession } from '../../application/use-cases/useSession'
import type { Account } from '../../domain/account'
import { ProfileCard } from '../components/account/ProfileCard'
import { ProfileForm, type ProfilePreview } from '../components/account/ProfileForm'
import { PROFILE_HINT } from '../components/account/profileLabels'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button, ButtonLink } from '@agile/ui'
import { ArrowRight01Icon, Tick02Icon } from '@agile/ui/icons'
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
    <AuthLayout title="Tus datos como ejecutor" description={`Persona natural u organización: quien registra y ejecuta proyectos públicos. ${PROFILE_HINT}`}>
      <ProfileForm
        account={me}
        submitLabel="Guardar y seguir"
        submitIcon={ArrowRight01Icon}
        onSubmit={updateProfile}
        onDone={go}
        secondaryAction={<Button variant="quiet" size="lg" onClick={go}>Completar después</Button>}
      />
    </AuthLayout>
  )
}

/** The same profile, later, from the account menu: how the team sees you on the left, following
 *  the form on the right as you type. Changes don't touch the projects you already joined, except the name and the photo. */
export function ProfilePage() {
  const { me } = useSession()
  if (!me) return null
  return <ProfileEditor key={me.id} account={me} />
}

function ProfileEditor({ account }: { account: Account }) {
  const navigate = useNavigate()
  const { updateProfile } = useSession()
  const [preview, setPreview] = useState<ProfilePreview>(account)

  return (
    <AppLayout topBar={<HomeTopBar />}>
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Mi perfil" />
        <div className="grid gap-3 pb-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
          <div className="lg:sticky lg:top-6">
            <ProfileCard profile={preview} email={account.email} />
          </div>
          <ProfileForm
            account={account}
            layout="sections"
            submitLabel="Guardar cambios"
            submitIcon={Tick02Icon}
            onSubmit={updateProfile}
            onPreview={setPreview}
            onDone={() => navigate('/')}
            secondaryAction={<ButtonLink to="/" variant="quiet" size="lg">Cancelar</ButtonLink>}
          />
        </div>
      </div>
    </AppLayout>
  )
}
