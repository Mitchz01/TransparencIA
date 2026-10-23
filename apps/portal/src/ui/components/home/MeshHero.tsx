import { useEffect, useState } from 'react'

/** The portal home's living gradient, the same as the team app's home (spec 016): six blobs drifting under a dark veil, with grain on top.
 *  Fills its positioned parent; pauses while the tab is hidden. Decoration only. */
export function MeshHero() {
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const update = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return (
    <div className="mesh" data-paused={paused || undefined} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="mesh-blob" />
      ))}
      <span className="mesh-veil" />
      <span className="mesh-grain" />
    </div>
  )
}
