import { NUTRIENT_META } from '../nutrition/nutrientKeys'
import type { NutrientKey, NutrientValues } from '../../types/recipe'
import { FDC_NUTRIENT_MAP } from './fdcNutrientMap'
import type { FdcFoodDetail, MappedFdcFood } from './usdaTypes'

// nfe는 계산값(§6.2)이라 import 대상이 아니다 → 결측 목록에서 제외.
const IMPORTABLE_NUTRIENT_KEYS = NUTRIENT_META.map((meta) => meta.key).filter(
  (key) => key !== 'nfe',
)

export function missingNutrientKeys(present: NutrientValues): NutrientKey[] {
  const have = new Set(Object.keys(present))
  return IMPORTABLE_NUTRIENT_KEYS.filter((key) => !have.has(key))
}

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

  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    nutrients,
    mappedKeys: Object.keys(nutrients) as NutrientKey[],
    missingKeys: missingNutrientKeys(nutrients),
  }
}
