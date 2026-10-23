// A project's cover (spec 016): a small mesh of the hero's palette, always the same for the same seed.

const MESH = ['--mesh-1', '--mesh-2', '--mesh-3', '--mesh-4', '--mesh-6'] as const
const BASES = ['--mesh-5', '--mesh-4', '--mesh-2'] as const

/** A small deterministic generator (mulberry32), so a seed always gives the same numbers. */
function random(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** A number from a project id or a template key. */
export function coverSeed(key: number | string): number {
  const text = String(key)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return hash >>> 0
}

export interface Cover {
  background: string
  /** Where the agents' mark sits, in % of the cover. */
  spark: { x: number; y: number; rotate: number }
}

/** Three blobs over a base, picked and placed by the seed. Colors are token variables only. */
export function cover(key: number | string): Cover {
  const next = random(coverSeed(key))
  const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)]
  const blobs = Array.from({ length: 3 }, () => {
    const x = Math.round(next() * 100)
    const y = Math.round(next() * 100)
    const size = 45 + Math.round(next() * 35)
    return `radial-gradient(${size}% ${size}% at ${x}% ${y}%, var(${pick(MESH)}) 0%, transparent 100%)`
  })
  return {
    background: [...blobs, `var(${pick(BASES)})`].join(', '),
    spark: { x: 55 + Math.round(next() * 30), y: 30 + Math.round(next() * 40), rotate: Math.round(next() * 90) },
  }
}
