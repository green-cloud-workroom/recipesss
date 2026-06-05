import { describe, expect, it } from 'vitest'

import { reorderPresets } from './presetReorder'
import type { Preset } from '../../types/recipe'

function preset(id: string, sortOrder: number): Preset {
  return {
    id,
    draftId: 'draft_cat',
    code: id,
    targetWeight: 100,
    label: '',
    unitIngredientId: 'ing_unit',
    inputAmount: 1,
    inputUnitLabel: '개',
    sortOrder,
    createdAt: 1,
  }
}

describe('reorderPresets', () => {
  it('moves an item down and returns only changed rows', () => {
    const changed = reorderPresets(
      [preset('preset_a', 0), preset('preset_b', 1), preset('preset_c', 2)],
      'preset_a',
      'preset_c',
    )

    expect(changed.map((item) => [item.id, item.sortOrder])).toEqual([
      ['preset_b', 0],
      ['preset_c', 1],
      ['preset_a', 2],
    ])
  })

  it('moves an item up and returns only changed rows', () => {
    const changed = reorderPresets(
      [preset('preset_a', 0), preset('preset_b', 1), preset('preset_c', 2)],
      'preset_c',
      'preset_a',
    )

    expect(changed.map((item) => [item.id, item.sortOrder])).toEqual([
      ['preset_c', 0],
      ['preset_a', 1],
      ['preset_b', 2],
    ])
  })

  it('returns an empty array for the same position', () => {
    expect(
      reorderPresets(
        [preset('preset_a', 0), preset('preset_b', 1)],
        'preset_a',
        'preset_a',
      ),
    ).toEqual([])
  })

  it('returns an empty array for missing ids', () => {
    expect(
      reorderPresets(
        [preset('preset_a', 0), preset('preset_b', 1)],
        'preset_missing',
        'preset_b',
      ),
    ).toEqual([])
  })

  it('returns an empty array for already contiguous empty input', () => {
    expect(reorderPresets([], 'preset_a', 'preset_b')).toEqual([])
  })

  it('only returns rows whose sortOrder changes', () => {
    const changed = reorderPresets(
      [preset('preset_a', 10), preset('preset_b', 1), preset('preset_c', 2)],
      'preset_b',
      'preset_c',
    )

    expect(changed.map((item) => [item.id, item.sortOrder])).toEqual([
      ['preset_a', 0],
      ['preset_c', 1],
      ['preset_b', 2],
    ])
  })
})
