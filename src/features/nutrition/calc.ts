import type {
  Ingredient,
  NutrientKey,
  NutrientValues,
  RecipeDraft,
} from '../../types/recipe'

export type IngredientMap = Record<string, Ingredient>

export function nfeGPer100g(values: NutrientValues): number {
  const dm = 100 - (values.moisture ?? 0)
  const known =
    (values.crudeProtein ?? 0) +
    (values.crudeFat ?? 0) +
    (values.crudeFiber ?? 0) +
    (values.ash ?? 0)

  return Math.max(0, dm - known)
}

export function meKcalPer100g(values: NutrientValues): number {
  const protein = values.crudeProtein ?? 0
  const fat = values.crudeFat ?? 0
  const nfe = nfeGPer100g(values)

  return 3.5 * protein + 8.5 * fat + 3.5 * nfe
}

export function sumRecipeNutrients(
  draft: RecipeDraft,
  ingredients: IngredientMap,
): NutrientValues {
  const totals: NutrientValues = {}

  for (const row of draft.composition) {
    const ingredient = ingredients[row.ingredientId]
    const profile = ingredient?.nutrientProfile
    if (!profile) continue

    const factor = row.weight / 100
    for (const [key, value] of nutrientEntries(profile)) {
      totals[key] = (totals[key] ?? 0) + value * factor
    }
  }

  return totals
}

export function totalWeightG(draft: RecipeDraft): number {
  return draft.composition.reduce((total, row) => total + row.weight, 0)
}

export function totalDryMatterG(
  draft: RecipeDraft,
  ingredients: IngredientMap,
): number {
  return draft.composition.reduce((total, row) => {
    const moisture = ingredients[row.ingredientId]?.nutrientProfile?.moisture ?? 0
    return total + row.weight * Math.max(0, 100 - moisture) / 100
  }, 0)
}

export function totalMeKcal(
  draft: RecipeDraft,
  ingredients: IngredientMap,
): number {
  return draft.composition.reduce((total, row) => {
    const profile = ingredients[row.ingredientId]?.nutrientProfile
    if (!profile) return total
    return total + (meKcalPer100g(profile) * row.weight) / 100
  }, 0)
}

export function per1000kcalME(
  values: NutrientValues,
  totalMe: number,
): NutrientValues {
  if (totalMe <= 0) return {}
  return scaleNutrients(values, 1000 / totalMe)
}

// FEDIAF perDm profile values are per 100 g dry matter. The SPEC function name
// is kept for compatibility, but this returns the same per-100g-DM basis.
export function perKgDryMatter(
  values: NutrientValues,
  totalDmG: number,
): NutrientValues {
  if (totalDmG <= 0) return {}
  return scaleNutrients(values, 100 / totalDmG)
}

export function nutrientEntries(
  values: NutrientValues,
): Array<[NutrientKey, number]> {
  return Object.entries(values).flatMap(([key, value]) => {
    if (value === undefined) return []
    return [[key as NutrientKey, value]]
  })
}

export function totalMeKcalFromTotals(
  values: NutrientValues,
  totalWeight: number,
): number {
  if (totalWeight <= 0) return 0
  const per100g = scaleNutrients(values, 100 / totalWeight)
  return (meKcalPer100g(per100g) * totalWeight) / 100
}

export function totalDryMatterGFromTotals(
  values: NutrientValues,
  totalWeight: number,
): number {
  if (totalWeight <= 0) return 0
  const moisture = values.moisture
  if (moisture === undefined) return totalWeight
  return Math.max(0, totalWeight - moisture)
}

function scaleNutrients(values: NutrientValues, factor: number): NutrientValues {
  const scaled: NutrientValues = {}
  for (const [key, value] of nutrientEntries(values)) {
    scaled[key] = value * factor
  }
  return scaled
}
