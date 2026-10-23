// Spec 017, US3 (owner: P4): publish the portal and hand out its link and QR.

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Button, buttonClasses, Icon, Segmented } from '@agile/ui'
import { ArrowDown02Icon, BrowserIcon, Copy01Icon, Link01Icon, Tick02Icon } from '@agile/ui/icons'
import { portalUrl } from './portalUrl'

type State = 'off' | 'on'

interface QrCardProps {
  isPublic: boolean
  publicUrl: string | null
  /** Only leaders publish (spec 017, D15); members see the state. */
  canManage: boolean
  onChange: (isPublic: boolean) => void
  changing?: boolean
}

export function QrCard({ isPublic, publicUrl, canManage, onChange, changing = false }: QrCardProps) {
  const url = isPublic && publicUrl ? portalUrl(publicUrl) : null
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!url) return
    let alive = true
    // Dark on white in both themes: phones read it best that way.
    QRCode.toDataURL(url, { width: 256, margin: 1, color: { dark: '#12150D', light: '#FFFFFF' } })
      .then((image) => alive && setQr({ url, image }))
      .catch(() => alive && setQr(null))
    return () => {
      alive = false
    }
  }, [url])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const image = qr && qr.url === url ? qr.image : null

  return (
    <div className="grid content-start gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading">Portal público</h2>
        <Segmented<State>
          label="Portal público"
          inset
          size="sm"
          value={isPublic ? 'on' : 'off'}
          disabled={!canManage || changing}
          options={[{ value: 'off', label: 'Sin publicar' }, { value: 'on', label: 'Publicado' }]}
          onChange={(value) => value !== (isPublic ? 'on' : 'off') && onChange(value === 'on')}
        />
      </div>

      {url ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {image ? (
              <img src={image} alt="Código QR del portal público" width={128} height={128} className="size-32 rounded-md" />
            ) : (
              <span aria-hidden="true" className="size-32 animate-pulse rounded-md bg-surface-strong" />
            )}
            <p className="min-w-0 flex-1 text-body text-ink-muted">
              Cualquiera que escanee el código ve el avance y el gasto, sin cuenta. Los borradores no se publican.
            </p>
          </div>
          <p className="flex min-w-0 items-center gap-2 rounded-pill bg-inset py-1 pr-1 pl-4">
            <Icon icon={Link01Icon} size={16} className="shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1 truncate text-label tabular-nums">{url}</span>
            <Button size="sm" icon={copied ? Tick02Icon : Copy01Icon} onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</Button>
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'md')}>
              <Icon icon={BrowserIcon} />
              Abrir portal
            </a>
            {image && (
              <a href={image} download="qr-portal-transparencia.png" className={buttonClasses('quiet', 'md')}>
                <Icon icon={ArrowDown02Icon} />
                Descargar QR
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-body text-ink-muted">
          {canManage
            ? 'Al publicarlo recibes un link y un código QR. Si lo despublicas, el link deja de funcionar; al volver a publicarlo es el mismo.'
            : 'Un líder del proyecto puede publicarlo.'}
        </p>
      )}
    </div>
  )
}
