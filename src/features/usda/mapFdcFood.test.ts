import { describe, expect, it } from 'vitest'

import { mapFdcFood } from './mapFdcFood'
import type { FdcFoodDetail } from './usdaTypes'

const eggFood: FdcFoodDetail = {
  fdcId: 171287,
  description: 'Egg, whole, raw, fresh',
  dataType: 'SR Legacy',
  foodNutrients: [
    { amount: 12.56, nutrient: { id: 1003, name: 'Protein', unitName: 'g' } },
    { amount: 9.51, nutrient: { id: 1004, name: 'Total lipid (fat)', unitName: 'g' } },
    { amount: 76.15, nutrient: { id: 1051, name: 'Water', unitName: 'g' } },
    { amount: 56, nutrient: { id: 1087, name: 'Calcium, Ca', unitName: 'mg' } },
    { amount: 198, nutrient: { id: 1091, name: 'Phosphorus, P', unitName: 'mg' } },
    { amount: 30.7, nutrient: { id: 1103, name: 'Selenium, Se', unitName: 'µg' } },
    { amount: 540, nutrient: { id: 1104, name: 'Vitamin A, IU', unitName: 'IU' } },
    { amount: 82, nutrient: { id: 1110, name: 'Vitamin D, IU', unitName: 'IU' } },
    { amount: 1.05, nutrient: { id: 1109, name: 'Vitamin E', unitName: 'mg' } },
    { amount: 0.38, nutrient: { id: 1215, name: 'Methionine', unitName: 'g' } },
    { amount: 0.272, nutrient: { id: 1216, name: 'Cystine', unitName: 'g' } },
    { amount: 0.68, nutrient: { id: 1217, name: 'Phenylalanine', unitName: 'g' } },
    { amount: 0.499, nutrient: { id: 1218, name: 'Tyrosine', unitName: 'g' } },
    { amount: 0.188, nutrient: { id: 1271, name: 'PUFA 20:4', unitName: 'g' } },
    { amount: 0, nutrient: { id: 1278, name: 'EPA', unitName: 'g' } },
    { amount: 0.058, nutrient: { id: 1272, name: 'DHA', unitName: 'g' } },
    { amount: 0.3, nutrient: { id: 1185, name: 'Vitamin K', unitName: 'µg' } },
    { amount: 0.1, nutrient: { id: 1184, name: 'Vitamin K dihydro', unitName: 'µg' } },
  ],
}

describe('mapFdcFood', () => {
  it('maps FDC per-100g values into recipesss nutrient units', () => {
    const mapped = mapFdcFood(eggFood)

    expect(mapped.nutrients.crudeProtein).toBe(12.56)
    expect(mapped.nutrients.crudeFat).toBe(9.51)
    expect(mapped.nutrients.moisture).toBe(76.15)
    expect(mapped.nutrients.calcium).toBeCloseTo(0.056)
    expect(mapped.nutrients.phosphorus).toBeCloseTo(0.198)
    expect(mapped.nutrients.selenium).toBe(30.7)
    expect(mapped.nutrients.vitaminA).toBe(540)
    expect(mapped.nutrients.vitaminD).toBe(82)
    expect(mapped.nutrients.vitaminE).toBeCloseTo(1.5645)
  })

  it('combines paired nutrients for pet-food profile keys', () => {
    const mapped = mapFdcFood(eggFood)

    expect(mapped.nutrients.methionineCystine).toBeCloseTo(0.652)
    expect(mapped.nutrients.phenylalanineTyrosine).toBeCloseTo(1.179)
    expect(mapped.nutrients.arachidonicAcid).toBeCloseTo(188)
    expect(mapped.nutrients.epaDha).toBeCloseTo(0.058)
    expect(mapped.nutrients.vitaminK).toBeCloseTo(0.4)
  })
})
