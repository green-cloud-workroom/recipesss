import { describe, expect, it } from 'vitest'

import { backfillPresetInputs, getPresetRatioInfo } from './presetRatio'
import type { Preset, RecipeDraft } from '../../types/recipe'

function draft(
  rows: Array<{ ingredientId: string; weight: number; unit?: 'g' | 'kg' }>,
  unitIngredientId = 'unit',
  unitLabel = '마리',
): RecipeDraft {
  return {
    id: 'draft_a',
    ownerUid: 'uid',
    name: 'draft',
    species: 'cat',
    unitIngredientId,
    unitLabel,
    composition: rows.map((row, index) => ({
      ingredientId: row.ingredientId,
      weight: row.weight,
      unit: row.unit ?? 'g',
      sortOrder: index,
    })),
    standardId: 'AAFCO_2024_CAT_ADULT',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('getPresetRatioInfo', () => {
  it('uses 마리/개 unit when the selected ingredient is the draft unit ingredient', () => {
    const d = draft([{ ingredientId: 'unit', weight: 10 }], 'unit', '마리')
    const info = getPresetRatioInfo(d, 'unit', 20)

    // targetWeight = raw(20) * unitRow.weight(10) = 200
    expect(info.targetWeight).toBe(200)
    expect(info.ratio).toBe(20)
    expect(info.inputUnitLabel).toBe('마리')
    expect(info.hasInput).toBe(true)
  })

  it('treats raw as grams when there is no unit label (g rows)', () => {
    const d = draft([{ ingredientId: 'unit', weight: 50, unit: 'g' }], 'unit', '')
    const info = getPresetRatioInfo(d, 'unit', 200)

    // unitLabel 없음 → targetWeight = raw 그대로
    expect(info.targetWeight).toBe(200)
    expect(info.ratio).toBe(4)
    expect(info.inputUnitLabel).toBe('g')
  })

  it('converts kg input to grams when the unit ingredient row is kg', () => {
    const d = draft([{ ingredientId: 'unit', weight: 500, unit: 'kg' }], 'unit', '')
    const info = getPresetRatioInfo(d, 'unit', 2)

    // kg → raw * 1000
    expect(info.targetWeight).toBe(2000)
    expect(info.ratio).toBe(4)
    expect(info.inputUnitLabel).toBe('kg')
  })

  it('does not apply 마리 unit when a non-unit ingredient is chosen as basis', () => {
    const d = draft(
      [
        { ingredientId: 'unit', weight: 10 },
        { ingredientId: 'other', weight: 30, unit: 'g' },
      ],
      'unit',
      '마리',
    )
    const info = getPresetRatioInfo(d, 'other', 60)

    // other는 레시피 단위원료가 아니므로 g 취급: targetWeight = 60
    expect(info.targetWeight).toBe(60)
    expect(info.ratio).toBe(2)
    expect(info.inputUnitLabel).toBe('g')
  })

  it('returns hasInput=false when the unit row is missing or weightless', () => {
    const d = draft([{ ingredientId: 'unit', weight: 0 }], 'unit', '마리')
    expect(getPresetRatioInfo(d, 'unit', 20)).toMatchObject({
      ratio: 1,
      targetWeight: 0,
      hasInput: false,
    })
    expect(getPresetRatioInfo(d, 'missing', 20)).toMatchObject({
      hasInput: false,
    })
  })

  it('returns hasInput=false when input amount is not positive', () => {
    const d = draft([{ ingredientId: 'unit', weight: 10 }], 'unit', '마리')
    const info = getPresetRatioInfo(d, 'unit', 0)

    expect(info.hasInput).toBe(false)
    expect(info.targetWeight).toBe(0)
    expect(info.inputUnitLabel).toBe('마리')
  })
})

describe('backfillPresetInputs', () => {
  function preset(
    id: string,
    targetWeight: number,
    inputAmount: number,
  ): Preset {
    return {
      id,
      draftId: 'draft_a',
      code: 'A0',
      targetWeight,
      label: '',
      unitIngredientId: 'unit',
      inputAmount,
      inputUnitLabel: '',
      sortOrder: 0,
      createdAt: 1,
    }
  }

  it('derives 마리 input from targetWeight / unit row weight', () => {
    const d = { ...draft([{ ingredientId: 'unit', weight: 800 }], 'unit', '마리'), id: 'draft_a' }
    const [result] = backfillPresetInputs([preset('p', 20000, 0)], [d])

    expect(result).toMatchObject({ inputAmount: 25, inputUnitLabel: '마리' })
  })

  it('derives kg input when the unit row is kg without a unit label', () => {
    const d = {
      ...draft([{ ingredientId: 'unit', weight: 1000, unit: 'kg' as const }], 'unit', ''),
      id: 'draft_a',
    }
    const [result] = backfillPresetInputs([preset('p', 120000, 0)], [d])

    expect(result).toMatchObject({ inputAmount: 120, inputUnitLabel: 'kg' })
  })

  it('leaves presets with an existing inputAmount untouched', () => {
    const d = { ...draft([{ ingredientId: 'unit', weight: 800 }], 'unit', '마리'), id: 'draft_a' }
    const original = preset('p', 20000, 5)
    const [result] = backfillPresetInputs([original], [d])

    expect(result).toBe(original)
  })
})
