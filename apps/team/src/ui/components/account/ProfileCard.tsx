import { groupDigits } from '../../../domain/account'
import { Avatar, Icon, NotchedPanel, StateLabel, type IconGlyph } from '@agile/ui'
import { Alert02Icon, Flag02Icon, Key01Icon, Route01Icon, SmartPhone01Icon, Tick02Icon, UserIcon } from '@agile/ui/icons'
import type { ProfilePreview } from './ProfileForm'
import { DOCUMENT_LABELS, NATURE_LABELS, PERSON_TYPE_LABELS } from './profileLabels'

/** "NIT 900.123.456-8" or "Cédula de ciudadanía 1.082.345.678". */
function documentText(profile: ProfilePreview): string | null {
  if (!profile.document_number || !profile.document_type) return null
  const number = /^\d+$/.test(profile.document_number) ? groupDigits(profile.document_number) : profile.document_number
  if (profile.document_type === 'NIT') return `NIT ${number}${profile.verification_digit ? `-${profile.verification_digit}` : ''}`
  return `${DOCUMENT_LABELS[profile.document_type]} ${number}`
}

/** Complete when the person type, the document, the contact and the data authorization are there. */
const isComplete = (profile: ProfilePreview) =>
  Boolean(profile.person_type && profile.document_number && profile.phone && profile.address && profile.municipality && profile.data_consent_at)

/** Who registers the projects, as the entities they work with see it (spec 020). It follows the form while you type. */
export function ProfileCard({ profile, email }: { profile: ProfilePreview; email: string }) {
  const legal = profile.person_type === 'juridica'
  const place = [profile.municipality, profile.department].filter(Boolean).join(', ')
  const rep = profile.legal_rep_name
    ? `${profile.legal_rep_name}${profile.legal_rep_document_number ? `, ${profile.legal_rep_document_type ?? 'CC'} ${groupDigits(profile.legal_rep_document_number)}` : ''}`
    : null
  const facts: { icon: IconGlyph; name: string; value: string | null }[] = [
    { icon: UserIcon, name: 'Tipo', value: profile.person_type ? PERSON_TYPE_LABELS[profile.person_type] : null },
    { icon: Key01Icon, name: 'Documento', value: documentText(profile) },
    ...(legal ? [
      { icon: Flag02Icon, name: 'Naturaleza', value: profile.entity_nature ? NATURE_LABELS[profile.entity_nature] : null },
      { icon: UserIcon, name: 'Representante', value: rep },
    ] : []),
    { icon: SmartPhone01Icon, name: legal ? 'Teléfono' : 'Celular', value: profile.phone },
    { icon: Route01Icon, name: 'Ubicación', value: place || null },
  ]

  return (
    <NotchedPanel
      as="article"
      aria-label="Así te ven las entidades"
      tone="surface"
      notch={{ width: 120, height: 120 }}
      radius={28}
      corner={<Avatar name={profile.legal_rep_name ?? profile.name} src={profile.avatar_url} size="lg" />}
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
            <dd className="min-w-0 truncate text-label text-ink tabular-nums" title={fact.value ?? undefined}>{fact.value ?? 'Sin dato'}</dd>
          </div>
        ))}
      </dl>

      {isComplete(profile)
        ? <StateLabel hue="teal" icon={Tick02Icon}>Datos completos y autorizados</StateLabel>
        : <StateLabel hue="amber" icon={Alert02Icon}>Faltan datos para registrar proyectos</StateLabel>}
    </NotchedPanel>
  )
}
