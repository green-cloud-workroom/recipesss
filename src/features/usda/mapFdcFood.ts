import { NUTRIENT_META } from '../nutrition/nutrientKeys'
import type { NutrientKey, NutrientValues } from '../../types/recipe'
import { FDC_NUTRIENT_MAP } from './fdcNutrientMap'
import type { FdcFoodDetail, MappedFdcFood } from './usdaTypes'

const ALL_NUTRIENT_KEYS = NUTRIENT_META.map((meta) => meta.key)

export function mapFdcFood(food: FdcFoodDetail): MappedFdcFood {
  const amountById = new Map<number, number>()
  for (const foodNutrient of food.foodNutrients ?? []) {
    const id = foodNutrient.nutrient?.id
    const amount = foodNutrient.amount
    if (id === undefined || amount === undefined || amount === null) continue
    amountById.set(id, amount)
  }

  const nutrients: NutrientValues = {}
  const assigned = new Set<NutrientKey>()

  for (const mapping of FDC_NUTRIENT_MAP) {
    const raw = amountById.get(mapping.nutrientId)
    if (raw === undefined) continue
    const value = raw * (mapping.factor ?? 1)
    if (mapping.combine) {
      nutrients[mapping.key] = (nutrients[mapping.key] ?? 0) + value
      assigned.add(mapping.key)
      continue
    }
    if (assigned.has(mapping.key)) continue
    nutrients[mapping.key] = value
    assigned.add(mapping.key)
  }

  const mappedKeys = nutrientKeys(nutrients)
  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    nutrients,
    mappedKeys,
    missingKeys: ALL_NUTRIENT_KEYS.filter((key) => !mappedKeys.includes(key)),
  }
}

function nutrientKeys(values: NutrientValues): NutrientKey[] {
  return Object.keys(values) as NutrientKey[]
}
