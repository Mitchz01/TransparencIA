import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ENTITY_NATURES, nitCheckDigit, onlyDigits, PERSON_DOCUMENTS, validateIdentification, validateProfile,
  type Account, type DocumentType, type EntityNature, type IdentificationField, type PersonDocument, type PersonType, type ProfileUpdate,
} from '../../../domain/account'
import { toFieldErrors, type FieldErrors } from '../../../domain/rules'
import { Button, Card, Checkbox, FieldError, Segmented, Select, TextField, type IconGlyph } from '@agile/ui'
import { CONSENT_TEXT, DOCUMENT_LABELS, NATURE_LABELS, PERSON_TYPE_LABELS } from './profileLabels'

interface ProfileDraft {
  personType: PersonType
  name: string
  documentType: PersonDocument
  documentNumber: string
  verificationDigit: string
  entityNature: EntityNature | ''
  repName: string
  repDocumentType: PersonDocument
  repDocumentNumber: string
  phone: string
  address: string
  municipality: string
  department: string
  consent: boolean
}

/** What the profile looks like with the edits so far: the profile page shows it while you type. */
export type ProfilePreview = Pick<Account, 'name' | 'avatar_url' | IdentificationField | 'data_consent_at'>

const draftFrom = (account: Account): ProfileDraft => ({
  personType: account.person_type ?? 'natural',
  name: account.name,
  documentType: account.document_type && account.document_type !== 'NIT' ? account.document_type : 'CC',
  documentNumber: account.document_number ?? '',
  verificationDigit: account.verification_digit ?? '',
  entityNature: account.entity_nature ?? '',
  repName: account.legal_rep_name ?? '',
  repDocumentType: account.legal_rep_document_type ?? 'CC',
  repDocumentNumber: account.legal_rep_document_number ?? '',
  phone: account.phone ?? '',
  address: account.address ?? '',
  municipality: account.municipality ?? '',
  department: account.department ?? '',
  consent: account.data_consent_at !== null,
})

const orNull = (value: string) => value.trim() || null

/** The whole identification, as PATCH takes it: a natural person sends nothing of a legal person. */
function identificationOf(draft: ProfileDraft): Pick<ProfileUpdate, IdentificationField> {
  const legal = draft.personType === 'juridica'
  return {
    person_type: draft.personType,
    document_type: (legal ? 'NIT' : draft.documentType) as DocumentType,
    document_number: orNull(draft.documentNumber),
    verification_digit: legal ? orNull(draft.verificationDigit) : null,
    entity_nature: legal && draft.entityNature ? draft.entityNature : null,
    legal_rep_name: legal ? orNull(draft.repName) : null,
    legal_rep_document_type: legal ? draft.repDocumentType : null,
    legal_rep_document_number: legal ? orNull(draft.repDocumentNumber) : null,
    phone: orNull(draft.phone),
    address: orNull(draft.address),
    municipality: orNull(draft.municipality),
    department: orNull(draft.department),
  }
}

function previewOf(account: Account, draft: ProfileDraft): ProfilePreview {
  return {
    ...identificationOf(draft),
    document_type: draft.personType === 'juridica' ? 'NIT' : draft.documentType,
    name: draft.name.trim() || account.name,
    avatar_url: account.avatar_url,
    data_consent_at: draft.consent ? account.data_consent_at ?? new Date().toISOString() : null,
  } as ProfilePreview
}

interface ProfileFormProps {
  account: Account
  /** `plain`: one column of fields (the step after sign up). `sections`: the fields grouped in cards (the profile page). */
  layout?: 'plain' | 'sections'
  submitLabel: string
  submitIcon?: IconGlyph
  /** Resolves with the field errors to show. */
  onSubmit: (update: ProfileUpdate) => Promise<FieldErrors>
  /** Called after saving. */
  onDone: () => void
  /** Called on every edit with the profile as it would look saved. */
  onPreview?: (preview: ProfilePreview) => void
  secondaryAction?: ReactNode
}

function Section({ card, title, description, children }: { card: boolean; title: string; description?: string; children: ReactNode }) {
  if (!card) {
    return (
      <fieldset className="grid gap-4">
        <legend className="mb-3 text-heading">{title}</legend>
        {children}
      </fieldset>
    )
  }
  return (
    <Card padding="lg" className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-heading">{title}</h2>
        {description && <p className="text-body text-ink-muted">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

/** Who registers public projects (spec 020): a natural or a legal person, with what Colombian rules ask
 *  of whoever contracts with the State, and the data authorization of Ley 1581 de 2012. */
export function ProfileForm({ account, layout = 'plain', submitLabel, submitIcon, onSubmit, onDone, onPreview, secondaryAction }: ProfileFormProps) {
  const [draft, setDraft] = useState(() => draftFrom(account))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const sections = layout === 'sections'
  // Inside a card the fields sit on `inset`; on the page they sit on `surface`.
  const fill = sections ? 'inset' : 'surface'
  const legal = draft.personType === 'juridica'

  const change = (patch: Partial<ProfileDraft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    setErrors({})
    onPreview?.(previewOf(account, next))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const update: ProfileUpdate = { ...identificationOf(draft) }
    if (draft.name.trim() !== account.name) update.name = draft.name
    if (draft.consent !== (account.data_consent_at !== null)) update.data_consent = draft.consent
    const local = toFieldErrors([...validateProfile({ name: draft.name }), ...validateIdentification(update, draft.consent)])
    if (Object.keys(local).length) return setErrors(local)
    setSending(true)
    const result = await onSubmit(update)
    setSending(false)
    setErrors(result)
    if (Object.keys(result).length === 0) onDone()
  }

  const text = (label: string, field: keyof ProfileDraft & string, error: string | undefined, extra: Record<string, unknown> = {}) => (
    <TextField label={label} fill={fill} value={draft[field] as string} error={error} onChange={(e) => change({ [field]: e.target.value } as Partial<ProfileDraft>)} {...extra} />
  )

  const nitDigits = onlyDigits(draft.documentNumber)
  const digitHint = nitDigits.length >= 8 && !draft.verificationDigit ? `Para ese NIT debería ser ${nitCheckDigit(nitDigits)}.` : 'El número después del guion en el RUT.'

  return (
    <form noValidate onSubmit={submit} aria-label="Datos de quien registra los proyectos" className={sections ? 'grid gap-3' : 'grid gap-8'}>
      {errors[''] && <FieldError>{errors['']}</FieldError>}

      <Section card={sections} title="Quién registra los proyectos" description="Una persona que contrata a su nombre, o una organización con su NIT.">
        <div>
          <Segmented<PersonType>
            label="Tipo de persona"
            inset={sections}
            value={draft.personType}
            options={(['natural', 'juridica'] as const).map((value) => ({ value, label: PERSON_TYPE_LABELS[value] }))}
            onChange={(personType) => change({ personType })}
          />
        </div>
        {legal ? (
          <>
            {text('Razón social', 'name', errors.name, { autoComplete: 'organization', placeholder: 'Fundación Manglares Vivos' })}
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              {text('NIT', 'documentNumber', errors.document_number, { inputMode: 'numeric', placeholder: '900123456', hint: 'Sin el dígito de verificación.' })}
              {text('Dígito de verificación', 'verificationDigit', errors.verification_digit, { inputMode: 'numeric', maxLength: 1, hint: digitHint })}
            </div>
            <Select
              label="Naturaleza"
              fill={fill}
              value={draft.entityNature}
              error={errors.entity_nature}
              options={[{ value: '', label: 'Elige una' }, ...ENTITY_NATURES.map((n) => ({ value: n, label: NATURE_LABELS[n] }))]}
              onChange={(e) => change({ entityNature: e.target.value as EntityNature | '' })}
            />
          </>
        ) : (
          <>
            {text('Nombres y apellidos', 'name', errors.name, { autoComplete: 'name', placeholder: 'Leo Ruiz Pérez' })}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Tipo de documento"
                fill={fill}
                value={draft.documentType}
                error={errors.document_type}
                options={PERSON_DOCUMENTS.map((d) => ({ value: d, label: DOCUMENT_LABELS[d] }))}
                onChange={(e) => change({ documentType: e.target.value as PersonDocument })}
              />
              {text('Número de documento', 'documentNumber', errors.document_number, { inputMode: draft.documentType === 'CC' ? 'numeric' : 'text', placeholder: '1082345678' })}
            </div>
          </>
        )}
      </Section>

      {legal && (
        <Section card={sections} title="Representante legal" description="Quien firma los contratos en nombre de la organización.">
          {text('Nombre del representante legal', 'repName', errors.legal_rep_name, { autoComplete: 'name', placeholder: 'Ana Gómez' })}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de documento del representante"
              fill={fill}
              value={draft.repDocumentType}
              error={errors.legal_rep_document_type}
              options={PERSON_DOCUMENTS.map((d) => ({ value: d, label: DOCUMENT_LABELS[d] }))}
              onChange={(e) => change({ repDocumentType: e.target.value as PersonDocument })}
            />
            {text('Número de documento del representante', 'repDocumentNumber', errors.legal_rep_document_number, { inputMode: 'numeric', placeholder: '52123456' })}
          </div>
        </Section>
      )}

      <Section card={sections} title="Contacto y ubicación" description="El correo de la cuenta es tu dirección de notificaciones.">
        <TextField label="Correo de notificaciones" fill={fill} value={account.email} disabled hint="Es el correo con el que entras; no se cambia aquí." />
        {text(legal ? 'Teléfono' : 'Celular', 'phone', errors.phone, { inputMode: 'tel', autoComplete: 'tel', placeholder: '3001234567' })}
        {text('Dirección', 'address', errors.address, { autoComplete: 'street-address', placeholder: 'Calle 22 # 3-45' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('Municipio', 'municipality', errors.municipality, { autoComplete: 'address-level2', placeholder: 'Santa Marta' })}
          {text('Departamento', 'department', errors.department, { autoComplete: 'address-level1', placeholder: 'Magdalena' })}
        </div>
      </Section>

      <Section card={sections} title="Tratamiento de datos personales">
        <div className="grid gap-2">
          <Checkbox label={CONSENT_TEXT} checked={draft.consent} onChange={(e) => change({ consent: e.target.checked })} />
          {errors.data_consent && <FieldError>{errors.data_consent}</FieldError>}
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {secondaryAction}
        <Button type="submit" variant="primary" size="lg" icon={submitIcon} loading={sending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
