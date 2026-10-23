import { Avatar, Icon, NotchedPanel } from '../ds'
import { Clock01Icon, GithubIcon, Layers01Icon, UserIcon } from '../ds/icons'
import type { ProfilePreview } from './ProfileForm'
import { SENIORITY_LABELS } from './profileLabels'

/** The profile as the team sees it (spec 015, FR-005): the photo sits in the panel's cut, the name
 *  next to it, then what a project copies when you join. It follows the form while you type. */
export function ProfileCard({ profile, email }: { profile: ProfilePreview; email: string }) {
  const facts = [
    { icon: UserIcon, name: 'Rol', value: profile.role ?? 'Sin rol' },
    { icon: Layers01Icon, name: 'Seniority', value: SENIORITY_LABELS[profile.seniority] },
    { icon: Clock01Icon, name: 'Disponibilidad', value: `${profile.hours_per_week} h por semana` },
    { icon: GithubIcon, name: 'GitHub', value: profile.github_username ? `@${profile.github_username}` : 'Sin usuario' },
  ]

  return (
    <NotchedPanel
      as="article"
      aria-label="Así te ve tu equipo"
      tone="surface"
      notch={{ width: 120, height: 120 }}
      radius={28}
      corner={<Avatar name={profile.name} src={profile.avatar_url} size="lg" />}
      className="grid gap-6 p-6"
    >
      {/* Text keeps clear of the cut, where the photo is. */}
      <div className="grid min-h-[84px] content-end gap-1 pr-[120px]">
        <h2 className="text-title break-words">{profile.name}</h2>
        <p className="truncate text-body text-ink-muted">{email}</p>
      </div>

      <dl className="grid gap-1.5">
        {facts.map((fact) => (
          <div key={fact.name} className="flex items-center justify-between gap-4 rounded-md bg-inset px-4 py-3">
            <dt className="inline-flex shrink-0 items-center gap-2 text-label font-normal text-ink-muted">
              <Icon icon={fact.icon} />
              {fact.name}
            </dt>
            <dd className="min-w-0 truncate text-label text-ink tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {profile.skills.length > 0 ? (
        <ul aria-label="Habilidades" className="flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <li key={skill} className="inline-flex h-7 items-center rounded-pill bg-inset px-3 text-caption text-ink">{skill}</li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-muted">Sin habilidades todavía. Los agentes reparten mejor el trabajo cuando las conocen.</p>
      )}
    </NotchedPanel>
  )
}
