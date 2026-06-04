import { describe, expect, it } from 'vitest'

import { nextSortOrder, selectPresetsByDraft } from './presetSelectors'
import type { Preset } from '../../types/recipe'

function preset(id: string, draftId: string, sortOrder: number): Preset {
  return {
    id,
    draftId,
    code: id,
    targetWeight: 100,
    label: '',
    unitIngredientId: 'ing_unit',
    inputAmount: 1,
    inputUnitLabel: 'kg',
    sortOrder,
    createdAt: 1,
  }
}

const presets = [
  preset('preset_b', 'draft_cat', 2),
  preset('preset_other', 'draft_dog', 0),
  preset('preset_a', 'draft_cat', 0),
  preset('preset_c', 'draft_cat', 1),
]

describe('selectPresetsByDraft', () => {
  it('filters presets by draft and sorts by sortOrder', () => {
    expect(selectPresetsByDraft(presets, 'draft_cat').map((p) => p.id)).toEqual(
      ['preset_a', 'preset_c', 'preset_b'],
    )
  })

  it('returns an empty list for a draft with no presets', () => {
    expect(selectPresetsByDraft(presets, 'draft_empty')).toEqual([])
  })
})

describe('nextSortOrder', () => {
  it('returns max sortOrder plus one for an existing draft', () => {
    expect(nextSortOrder(presets, 'draft_cat')).toBe(3)
  })

  it('returns zero for a draft with no presets', () => {
    expect(nextSortOrder(presets, 'draft_empty')).toBe(0)
  })

  it('ignores presets for other drafts', () => {
    expect(nextSortOrder(presets, 'draft_dog')).toBe(1)
  })
})
