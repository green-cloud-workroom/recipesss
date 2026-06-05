import type { Ingredient, Preset, RecipeDraft } from '../../types/recipe'

export type IngredientMergePlan = {
  target: Ingredient
  deleteIds: string[]
  changedDrafts: RecipeDraft[]
  changedPresets: Preset[]
  // 동일 원료 행이 합산된 draft id들 (DL-034). 모달 경고 + 붉은 버튼 게이트용.
  summedDraftIds: string[]
}

export function buildIngredientMergePlan({
  drafts,
  ingredients,
  presets,
  now,
  selectedIds,
  targetName,
}: {
  drafts: RecipeDraft[]
  ingredients: Ingredient[]
  // 선택: 넘기지 않으면 프리셋 치환은 생략 (배선은 별도 작업).
  presets?: Preset[]
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

  const summedDraftIds: string[] = []
  const changedDrafts = drafts.flatMap((draft) => {
    const hadDuplicateRow = draft.composition.some((row) =>
      duplicateIds.has(row.ingredientId),
    )
    const unitChanged = duplicateIds.has(draft.unitIngredientId)
    if (!hadDuplicateRow && !unitChanged) return []

    // duplicate → target 치환 후, target id 행을 한 행으로 합산 (weight 합, 첫 등장
    // 위치·unit 유지). 그 외 행은 그대로. (체크포인트 1)
    let mergedIndex = -1
    let mergedWeight = 0
    let targetRowCount = 0
    const composition: RecipeDraft['composition'] = []
    for (const row of draft.composition) {
      const mapsToTarget =
        row.ingredientId === target.id || duplicateIds.has(row.ingredientId)
      if (!mapsToTarget) {
        composition.push(row)
        continue
      }
      targetRowCount += 1
      mergedWeight += row.weight
      if (mergedIndex === -1) {
        composition.push({ ...row, ingredientId: target.id })
        mergedIndex = composition.length - 1
      }
    }
    if (mergedIndex !== -1) {
      composition[mergedIndex] = {
        ...composition[mergedIndex]!,
        weight: mergedWeight,
      }
    }

    // 병합으로 target 행이 2개 이상 합쳐졌을 때만 확인 게이트.
    const summed = hadDuplicateRow && targetRowCount >= 2
    if (summed) summedDraftIds.push(draft.id)

    const next: RecipeDraft = {
      ...draft,
      composition,
      unitIngredientId: unitChanged ? target.id : draft.unitIngredientId, // 체크포인트 2
      updatedAt: now,
    }
    if (summed) next.mergeReviewPending = true

    return [next]
  })

  // 프리셋의 unitIngredientId도 치환 (체크포인트 3). presets 미전달 시 생략.
  const changedPresets = (presets ?? []).flatMap((preset) => {
    if (!duplicateIds.has(preset.unitIngredientId)) return []
    return [{ ...preset, unitIngredientId: target.id }]
  })

  return {
    target: { ...target, name },
    deleteIds: [...duplicateIds],
    changedDrafts,
    changedPresets,
    summedDraftIds,
  }
}
