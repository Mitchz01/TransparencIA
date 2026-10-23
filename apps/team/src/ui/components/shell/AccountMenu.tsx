import { useNavigate } from 'react-router-dom'
import { useSession } from '../../../application/use-cases/useSession'
import { Avatar, Menu } from '@agile/ui'
import { Logout01Icon, UserEdit01Icon } from '@agile/ui/icons'

/** Who is signed in, their profile and signing out (spec 015). In both top bars. */
export function AccountMenu() {
  const navigate = useNavigate()
  const { me, signOut } = useSession()
  if (!me) return null
  return (
    <Menu
      label={`Cuenta: ${me.name}`}
      align="end"
      chevron={false}
      // `!`: the button's own size class sets px-5, which would leave the avatar no room.
      buttonClassName="size-control-md px-0! overflow-hidden"
      header={
        <>
          <span className="truncate text-label">{me.name}</span>
          <span className="truncate text-caption text-ink-muted">{me.email}</span>
        </>
      }
      items={[
        { key: 'profile', label: 'Mi perfil', icon: UserEdit01Icon, onSelect: () => navigate('/profile') },
        {
          key: 'sign-out',
          label: 'Cerrar sesión',
          icon: Logout01Icon,
          onSelect: () => void signOut().then(() => navigate('/login', { replace: true })),
        },
      ]}
    >
      <Avatar name={me.name} src={me.avatar_url} size="md" className="bg-transparent" />
    </Menu>
  )
}
