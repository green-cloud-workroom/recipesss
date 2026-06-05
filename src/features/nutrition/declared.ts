import type { NutrientKey, RecipeDraft } from '../../types/recipe'
import {
  sumRecipeNutrients,
  type IngredientMap,
} from './calc'

export function syncDeclaredFromCalculated(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  now: number,
): RecipeDraft {
  return {
    ...draft,
    declaredNutrients: sumRecipeNutrients(draft, ingredients),
    declaredNutrientsUpdatedAt: now,
  }
}

export function effectiveNutrient(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  key: NutrientKey,
): number | undefined {
  const declared = draft.declaredNutrients?.[key]
  if (declared !== undefined && declared !== null) return declared

  return sumRecipeNutrients(draft, ingredients)[key]
}

export function effectiveNutrients(
  draft: RecipeDraft,
  ingredients: IngredientMap,
): ReturnType<typeof sumRecipeNutrients> {
  return {
    ...sumRecipeNutrients(draft, ingredients),
    ...draft.declaredNutrients,
  }
}
