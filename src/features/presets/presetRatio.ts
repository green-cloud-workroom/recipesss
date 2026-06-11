import type { Preset, RecipeDraft } from '../../types/recipe'

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

// v2 마이그레이션 프리셋 중 inputAmount가 비어 있는 것들을 targetWeight에서 역산해
// 채운다 (§6.7 환산식의 역방향). 변경 없으면 동일 객체 유지.
export function backfillPresetInputs(
  presets: Preset[],
  drafts: RecipeDraft[],
): Preset[] {
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]))

  return presets.map((preset) => {
    if (Number(preset.inputAmount) > 0) return preset
    if (!(preset.targetWeight > 0)) return preset
    const draft = draftById.get(preset.draftId)
    if (!draft) return preset

    const unitIngId = preset.unitIngredientId || draft.unitIngredientId
    const unitRow = draft.composition.find(
      (row) => row.ingredientId === unitIngId,
    )
    if (!unitRow || !(unitRow.weight > 0)) return preset

    const unitLabel =
      draft.unitIngredientId === unitIngId ? (draft.unitLabel ?? '').trim() : ''

    if (unitLabel) {
      // 마리/개: targetWeight = 마리수 × 단위원료 weight
      return {
        ...preset,
        inputAmount: preset.targetWeight / unitRow.weight,
        inputUnitLabel: unitLabel,
      }
    }
    if (unitRow.unit === 'kg') {
      return {
        ...preset,
        inputAmount: preset.targetWeight / 1000,
        inputUnitLabel: 'kg',
      }
    }
    return { ...preset, inputAmount: preset.targetWeight, inputUnitLabel: 'g' }
  })
}
