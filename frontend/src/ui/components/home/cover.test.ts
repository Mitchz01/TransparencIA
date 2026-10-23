import { describe, expect, it } from 'vitest'
import { cover, coverSeed } from './cover'

describe('cover', () => {
  it('is the same for the same project', () => {
    expect(cover(7)).toEqual(cover(7))
    expect(coverSeed('7')).toBe(coverSeed(7))
  })

  it('differs between projects', () => {
    expect(cover(1).background).not.toBe(cover(2).background)
  })

  it('uses only the mesh tokens', () => {
    const colors = cover(42).background.match(/var\([^)]+\)/g)
    expect(colors?.every((c) => /^var\(--mesh-\d\)$/.test(c))).toBe(true)
  })
})
