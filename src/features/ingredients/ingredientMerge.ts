import type { Ingredient, RecipeDraft } from '../../types/recipe'

export type IngredientMergePlan = {
  target: Ingredient
  deleteIds: string[]
  changedDrafts: RecipeDraft[]
}

export function buildIngredientMergePlan({
  drafts,
  ingredients,
  now,
  selectedIds,
  targetName,
}: {
  drafts: RecipeDraft[]
  ingredients: Ingredient[]
  now: number
  selectedIds: string[]
  targetName: string
}): IngredientMergePlan {
  const uniqueIds = [...new Set(selectedIds)]
  if (uniqueIds.length < 2) {
    throw new Error('병합할 원료를 2개 이상 선택하세요.')
  }

  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const selected = uniqueIds.map((id) => byId.get(id))

  if (selected.some((ingredient) => !ingredient)) {
    throw new Error('선택한 원료를 찾을 수 없습니다.')
  }

  const [target, ...duplicates] = selected as [Ingredient, ...Ingredient[]]
  const kind = target.kind
  if (duplicates.some((ingredient) => ingredient.kind !== kind)) {
    throw new Error('원료와 영양제는 서로 병합할 수 없습니다.')
  }

  const name = targetName.trim()
  if (!name) {
    throw new Error('병합 후 원료명을 입력하세요.')
  }

  const duplicateIds = new Set(duplicates.map((ingredient) => ingredient.id))
  const changedDrafts = drafts.flatMap((draft) => {
    let changed = false
    const composition = draft.composition.map((row) => {
      if (!duplicateIds.has(row.ingredientId)) return row
      changed = true
      return { ...row, ingredientId: target.id }
    })

    if (!changed) return []
    return [{ ...draft, composition, updatedAt: now }]
  })

  return {
    target: { ...target, name },
    deleteIds: [...duplicateIds],
    changedDrafts,
  }
}
