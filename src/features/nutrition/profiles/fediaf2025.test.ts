import { describe, expect, it } from 'vitest'

import { FEDIAF_2025_PROFILES } from './fediaf2025'
import { ALL_PROFILES, getProfile, profilesForSpecies } from './index'

const byId = (id: string) => {
  const p = FEDIAF_2025_PROFILES.find((profile) => profile.id === id)
  if (!p) throw new Error(`profile not found: ${id}`)
  return p
}

describe('FEDIAF 2025 profiles', () => {
  it('loads exactly 7 profiles (dog 4, cat 3)', () => {
    expect(FEDIAF_2025_PROFILES).toHaveLength(7)
    expect(FEDIAF_2025_PROFILES.filter((p) => p.species === 'dog')).toHaveLength(4)
    expect(FEDIAF_2025_PROFILES.filter((p) => p.species === 'cat')).toHaveLength(3)
  })

  it('has unique ids', () => {
    const ids = FEDIAF_2025_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every requirement has min <= max', () => {
    for (const profile of FEDIAF_2025_PROFILES) {
      for (const basis of [profile.perMe, profile.perDm]) {
        for (const [key, req] of Object.entries(basis)) {
          if (req.max !== undefined) {
            expect(req.min, `${profile.id}.${key}`).toBeLessThanOrEqual(req.max)
          }
        }
      }
    }
  })

  it('matches known spot values (dog adult MER95, per ME)', () => {
    const p = byId('FEDIAF_2025_DOG_ADULT_MER95')
    expect(p.perMe.crudeProtein?.min).toBe(52.1)
    expect(p.perMe.calcium).toEqual({ min: 1.45, max: 6.25, maxType: 'nutritional' })
    expect(p.perDm.copper).toEqual({ min: 0.83, max: 2.8, maxType: 'legal' })
    expect(p.ratios?.caP).toEqual({ min: 1, max: 2 })
  })

  it('uses large-breed (b) calcium for dog late growth', () => {
    const p = byId('FEDIAF_2025_DOG_LATE_GROWTH')
    expect(p.perDm.calcium?.min).toBe(1.0)
    expect(p.perMe.calcium?.min).toBe(2.5)
    expect(p.ratios?.caP?.max).toBe(1.8)
  })

  it('cat has taurine (dry basis) and no dog taurine', () => {
    const cat = byId('FEDIAF_2025_CAT_GROWTH_REPRO')
    expect(cat.perMe.taurine?.min).toBe(0.25)
    expect(cat.perDm.taurine?.min).toBe(0.1)
    const dog = byId('FEDIAF_2025_DOG_ADULT_MER95')
    expect(dog.perMe.taurine).toBeUndefined()
  })

  it('legal max only on DM basis, not ME', () => {
    const p = byId('FEDIAF_2025_DOG_ADULT_MER95')
    expect(p.perDm.zinc?.maxType).toBe('legal')
    expect(p.perMe.zinc?.max).toBeUndefined()
  })

  it('per-ME ~= per-DM x 2.5 (transcription cross-check, tol 25%)', () => {
    for (const profile of FEDIAF_2025_PROFILES) {
      for (const [key, me] of Object.entries(profile.perMe)) {
        const dm = profile.perDm[key as keyof typeof profile.perDm]
        if (!dm) continue
        const expected = dm.min * 2.5
        const diff = Math.abs(me.min - expected) / me.min
        expect(diff, `${profile.id}.${key} ME=${me.min} DMx2.5=${expected}`).toBeLessThan(0.25)
      }
    }
  })

  it('registry getters work (FEDIAF 7 + AAFCO 4 = 11)', () => {
    expect(ALL_PROFILES).toHaveLength(11)
    expect(getProfile('FEDIAF_2025_CAT_ADULT_MER75')?.species).toBe('cat')
    expect(getProfile('nope')).toBeUndefined()
    expect(profilesForSpecies('dog')).toHaveLength(6) // FEDIAF 4 + AAFCO 2
    expect(profilesForSpecies('cat')).toHaveLength(5) // FEDIAF 3 + AAFCO 2
  })
})
