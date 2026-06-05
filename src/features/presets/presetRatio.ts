import type { RecipeDraft } from '../../types/recipe'

// SPEC §6.7 — v2 selectors.js getRatioInfo 포팅. 순수함수 (Firebase·React 없음).
// 프리셋은 unitIngredientId(생산단위 원료) + inputAmount(생산량)만 입력받고,
// targetWeight·ratio·inputUnitLabel을 도출한다.
export type RatioInfo = {
  ratio: number // 모든 원료 weight × ratio
  targetWeight: number // g
  inputUnitLabel: string // 입력 단위 표시 ('마리'/'개'/'g'/'kg')
  hasInput: boolean
}

export function getPresetRatioInfo(
  draft: RecipeDraft,
  unitIngredientId: string,
  inputAmount: number,
): RatioInfo {
  const unitRow = draft.composition.find(
    (row) => row.ingredientId === unitIngredientId,
  )
  if (!unitRow || unitRow.weight <= 0) {
    return { ratio: 1, targetWeight: 0, inputUnitLabel: 'g', hasInput: false }
  }

  // 레시피 단위원료와 같을 때만 '마리'/'개' 단위 적용.
  const unitLabel =
    draft.unitIngredientId === unitIngredientId
      ? (draft.unitLabel ?? '').trim()
      : ''
  const inputUnitLabel = unitLabel || unitRow.unit || 'g'

  const raw = inputAmount
  if (!(raw > 0)) {
    return { ratio: 1, targetWeight: 0, inputUnitLabel, hasInput: false }
  }

  const targetWeight = unitLabel
    ? raw * unitRow.weight
    : unitRow.unit === 'kg'
      ? raw * 1000
      : raw
  const ratio = targetWeight / unitRow.weight

  return { ratio, targetWeight, inputUnitLabel, hasInput: true }
}
