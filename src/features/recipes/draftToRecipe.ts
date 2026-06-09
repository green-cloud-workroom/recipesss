import type { IngredientMap } from '../nutrition/calc'
import type { RecipeDraft, Species } from '../../types/recipe'

// 생산앱 recipes 부분 문서 (SPEC §4.2/§6.6, DL-037). createdAt/updatedAt는
// mutation에서 serverTimestamp로 채운다.
export type RecipeIngredientRow = {
  id: string
  name: string
  baseWeightG: number
  unitName: 'g' | 'kg'
  isProductionUnit: boolean
  sortOrder: number
  autoDeductInventory: boolean
  linkedToInventory: boolean
}

export type DraftRecipePayload = {
  name: string
  displayName: string
  target: string
  category: string
  active: boolean
  version: number
  sortOrder: number
  ingredients: RecipeIngredientRow[]
  unitPresets: number[]
  source: 'recipesss'
  recipesssDraftId: string
  createdBy: string
}

// DL-037 확정: cat→cat, dog→dog, null(미지정)→common.
export function speciesToTarget(species: Species): string {
  if (species === 'cat') return 'cat'
  if (species === 'dog') return 'dog'
  return 'common'
}

export function countSupplements(
  draft: RecipeDraft,
  ingredients: IngredientMap,
): number {
  return draft.composition.filter(
    (row) => ingredients[row.ingredientId]?.kind === 'supplement',
  ).length
}

export function draftToRecipe(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  ownerUid: string,
): DraftRecipePayload {
  // 영양제(supplement) 제외 (DL-025).
  const ingredients_ = draft.composition
    .filter((row) => ingredients[row.ingredientId]?.kind === 'ingredient')
    .map((row): RecipeIngredientRow => {
      const ingredient = ingredients[row.ingredientId]
      return {
        id: row.ingredientId,
        name: ingredient?.name ?? row.ingredientId,
        baseWeightG: row.weight,
        unitName: row.unit,
        isProductionUnit: row.ingredientId === draft.unitIngredientId,
        sortOrder: row.sortOrder,
        autoDeductInventory: false,
        linkedToInventory: false,
      }
    })

  return {
    name: draft.name,
    displayName: draft.name,
    target: speciesToTarget(draft.species),
    category: 'raw', // recipesss엔 개념 없음 → 기본값, 생산앱에서 보완 (DL-037)
    active: false, // 항상 비활성으로 등록 → 생산앱에서 보완 후 활성화
    version: 1,
    sortOrder: 0,
    ingredients: ingredients_,
    unitPresets: [],
    source: 'recipesss',
    recipesssDraftId: draft.id,
    createdBy: ownerUid,
  }
}
