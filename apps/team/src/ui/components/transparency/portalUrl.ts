// Spec 017 (owner: P4): where the QR and the link of the public portal point.

/** The portal is its own app (spec 018): a relative public_url gets the portal's origin, never the team app's. */
export function portalUrl(publicUrl: string): string {
  if (!publicUrl.startsWith('/')) return publicUrl
  const base = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || 'http://localhost:5174'
  return `${base.replace(/\/$/, '')}${publicUrl}`
}
