import { describe, expect, it } from 'vitest'

import { NRC_2006_PROFILES } from './nrc2006'

const byId = (id: string) => {
  const p = NRC_2006_PROFILES.find((profile) => profile.id === id)
  if (!p) throw new Error(`profile not found: ${id}`)
  return p
}

describe('NRC 2006 profiles', () => {
  it('loads 2 adult profiles (dog, cat)', () => {
    expect(NRC_2006_PROFILES).toHaveLength(2)
    expect(NRC_2006_PROFILES.every((p) => p.standard === 'NRC')).toBe(true)
    expect(NRC_2006_PROFILES.every((p) => p.lifeStage === 'adult')).toBe(true)
  })

  it('perMe only (NRC gives per-1000kcal); perDm empty', () => {
    for (const p of NRC_2006_PROFILES) {
      expect(Object.keys(p.perMe).length).toBeGreaterThan(20)
      expect(Object.keys(p.perDm)).toHaveLength(0)
    }
  })

  it('matches known RA spot values with unit conversion', () => {
    const dog = byId('NRC_2006_DOG_ADULT')
    expect(dog.perMe.crudeProtein?.min).toBe(25)
    expect(dog.perMe.calcium?.min).toBe(1) // g/1000kcal
    expect(dog.perMe.iodine?.min).toBe(0.22) // 220 mcg -> mg
    expect(dog.perMe.selenium?.min).toBe(87.5) // mcg -> µg
    expect(dog.perMe.chloride?.min).toBe(0.3) // 300 mg -> g
    const cat = byId('NRC_2006_CAT_ADULT')
    expect(cat.perMe.taurine?.min).toBe(0.1)
  })

  it('omits sodium and fat-soluble vitamins (A/D/E/K)', () => {
    const dog = byId('NRC_2006_DOG_ADULT')
    for (const k of ['sodium', 'vitaminA', 'vitaminD', 'vitaminE', 'vitaminK'] as const) {
      expect(dog.perMe[k]).toBeUndefined()
    }
  })
})
