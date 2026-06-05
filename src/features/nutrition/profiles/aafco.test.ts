import { describe, expect, it } from 'vitest'

import { AAFCO_PROFILES } from './aafco'

const byId = (id: string) => {
  const p = AAFCO_PROFILES.find((profile) => profile.id === id)
  if (!p) throw new Error(`profile not found: ${id}`)
  return p
}

describe('AAFCO profiles', () => {
  it('loads 4 profiles (dog 2, cat 2)', () => {
    expect(AAFCO_PROFILES).toHaveLength(4)
    expect(AAFCO_PROFILES.filter((p) => p.species === 'dog')).toHaveLength(2)
    expect(AAFCO_PROFILES.filter((p) => p.species === 'cat')).toHaveLength(2)
    expect(AAFCO_PROFILES.every((p) => p.standard === 'AAFCO')).toBe(true)
  })

  it('every requirement has min <= max', () => {
    for (const profile of AAFCO_PROFILES) {
      for (const basis of [profile.perMe, profile.perDm]) {
        for (const [key, req] of Object.entries(basis)) {
          if (req.max !== undefined) {
            expect(req.min, `${profile.id}.${key}`).toBeLessThanOrEqual(req.max)
          }
        }
      }
    }
  })

  it('matches known dog growth spot values (per ME)', () => {
    const p = byId('AAFCO_2014_DOG_GROWTH')
    expect(p.perMe.crudeProtein?.min).toBe(56.3)
    expect(p.perMe.calcium).toEqual({ min: 3, max: 6.25, maxType: 'nutritional' })
    expect(p.ratios?.caP).toEqual({ min: 1, max: 2 })
  })

  it('converts mg -> µg for selenium / B9 / B12 / K', () => {
    const p = byId('AAFCO_2014_DOG_GROWTH')
    expect(p.perMe.selenium).toEqual({ min: 90, max: 500, maxType: 'nutritional' }) // 0.09/0.5 mg
    expect(p.perMe.vitaminB9?.min).toBe(54) // 0.054 mg
    const cat = byId('AAFCO_2014_CAT_ADULT')
    expect(cat.perMe.vitaminK?.min).toBe(25) // 0.025 mg
    expect(cat.perMe.taurine?.min).toBe(0.25) // extruded basis
  })

  it('perDm = perMe x 0.4 (4000 kcal/kg DM assumption)', () => {
    const p = byId('AAFCO_2014_DOG_ADULT')
    const me = p.perMe.crudeProtein?.min ?? 0
    const dm = p.perDm.crudeProtein?.min ?? 0
    expect(dm).toBeCloseTo(me * 0.4, 4)
  })

  it('cat profiles omit Ca/P ratio (not in AAFCO calorie table)', () => {
    expect(byId('AAFCO_2014_CAT_GROWTH').ratios).toBeUndefined()
  })
})
