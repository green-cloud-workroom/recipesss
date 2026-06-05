import { describe, expect, it } from 'vitest'

import {
  buildOrderSummary,
  filterOrderGroups,
  formatOrderLine,
  groupLabel,
  groupPresetsByRecipe,
  speciesLabel,
  totalSelectedCount,
  type OrderGroup,
} from './orderSelectors'
import type { Preset, RecipeDraft, Species } from '../../types/recipe'

function draft(
  id: string,
  name: string,
  species: Species,
  sortOrder: number,
  unitLabel = 'unit',
): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name,
    species,
    unitIngredientId: 'ing_unit',
    unitLabel,
    composition: [],
    standardId: 'AAFCO_2024_CAT_ADULT',
    status: 'draft',
    sortOrder,
    createdAt: 1,
    updatedAt: 1,
  }
}

function preset(
  id: string,
  draftId: string,
  code: string,
  sortOrder: number,
): Preset {
  return {
    id,
    draftId,
    code,
    targetWeight: 100,
    label: '',
    unitIngredientId: 'ing_unit',
    inputAmount: 1,
    inputUnitLabel: 'unit',
    sortOrder,
    createdAt: 1,
  }
}

describe('speciesLabel', () => {
  it('returns labels for species values', () => {
    expect(speciesLabel('cat')).toBeDefined()
    expect(speciesLabel('dog')).toBeDefined()
    expect(speciesLabel(null)).toBeDefined()
  })
})

describe('groupLabel', () => {
  it('combines species and draft name', () => {
    expect(groupLabel(draft('draft_cat', 'Chicken', 'cat', 0))).toContain(
      'Chicken',
    )
  })
})

describe('groupPresetsByRecipe', () => {
  it('groups presets by draft and sorts drafts and presets by sortOrder', () => {
    const groups = groupPresetsByRecipe(
      [
        draft('draft_dog', 'Dog', 'dog', 2),
        draft('draft_cat', 'Cat', 'cat', 1),
      ],
      [
        preset('preset_b', 'draft_cat', 'a1', 2),
        preset('preset_dog', 'draft_dog', 'c0', 0),
        preset('preset_a', 'draft_cat', 'a0', 1),
      ],
    )

    expect(groups.map((group) => group.draftId)).toEqual([
      'draft_cat',
      'draft_dog',
    ])
    expect(groups[0]?.presets.map((item) => item.id)).toEqual([
      'preset_a',
      'preset_b',
    ])
  })

  it('omits drafts with no presets and orphan presets', () => {
    const groups = groupPresetsByRecipe(
      [
        draft('draft_empty', 'Empty', null, 0),
        draft('draft_cat', 'Cat', 'cat', 1),
      ],
      [
        preset('preset_orphan', 'draft_missing', 'x0', 0),
        preset('preset_a', 'draft_cat', 'a0', 0),
      ],
    )

    expect(groups.map((group) => group.draftId)).toEqual(['draft_cat'])
  })

  it('uses species and unitLabel from the draft', () => {
    const groups = groupPresetsByRecipe(
      [draft('draft_cat', 'Cat', 'cat', 0, 'piece')],
      [preset('preset_a', 'draft_cat', 'a0', 0)],
    )

    expect(groups[0]?.species).toBe('cat')
    expect(groups[0]?.unitLabel).toBe('piece')
  })
})

describe('buildOrderSummary', () => {
  const groups: OrderGroup[] = groupPresetsByRecipe(
    [
      draft('draft_cat', 'Cat', 'cat', 0, 'piece'),
      draft('draft_dog', 'Dog', 'dog', 1, 'batch'),
    ],
    [
      preset('preset_a', 'draft_cat', 'a0', 0),
      preset('preset_b', 'draft_cat', 'a1', 1),
      preset('preset_c', 'draft_dog', 'c0', 0),
    ],
  )

  it('includes only selected presets and keeps group/item order', () => {
    const summary = buildOrderSummary(groups, {
      preset_b: true,
      preset_c: true,
    })

    expect(summary).toEqual([
      {
        draftId: 'draft_cat',
        label: `${speciesLabel('cat') ? `(${speciesLabel('cat')})` : ''}Cat`,
        items: [{ code: 'a1' }],
      },
      {
        draftId: 'draft_dog',
        label: `${speciesLabel('dog') ? `(${speciesLabel('dog')})` : ''}Dog`,
        items: [{ code: 'c0' }],
      },
    ])
  })

  it('omits groups with no selected presets', () => {
    expect(buildOrderSummary(groups, { preset_c: true })).toHaveLength(1)
  })
})

describe('filterOrderGroups', () => {
  const groups: OrderGroup[] = groupPresetsByRecipe(
    [
      draft('draft_cat', 'Cat Chicken', 'cat', 0),
      draft('draft_dog', 'Dog Duck', 'dog', 1),
      draft('draft_freeze', '동결 주식치킨', 'dog', 2),
    ],
    [
      preset('preset_cat', 'draft_cat', 'a0', 0),
      preset('preset_dog', 'draft_dog', 'b0', 0),
      preset('preset_freeze', 'draft_freeze', 'c0', 0),
    ],
  )

  it('keeps all groups for the all filter', () => {
    expect(filterOrderGroups(groups, 'all').map((group) => group.draftId))
      .toEqual(['draft_cat', 'draft_dog', 'draft_freeze'])
  })

  it('filters groups by species', () => {
    expect(filterOrderGroups(groups, 'cat').map((group) => group.draftId))
      .toEqual(['draft_cat'])
    expect(filterOrderGroups(groups, 'dog').map((group) => group.draftId))
      .toEqual(['draft_dog', 'draft_freeze'])
  })

  it('filters freeze-dried groups by draft name', () => {
    expect(
      filterOrderGroups(groups, 'freezeDried').map((group) => group.draftId),
    ).toEqual(['draft_freeze'])
  })
})

describe('formatOrderLine', () => {
  it('formats a summary group with selected preset codes', () => {
    expect(
      formatOrderLine({
        draftId: 'draft_cat',
        label: 'Cat',
        items: [{ code: 'a0' }, { code: 'a1' }],
      }),
    ).toBe('Cat  a0 / a1')
  })
})

describe('totalSelectedCount', () => {
  it('counts selected preset ids', () => {
    expect(totalSelectedCount({ preset_a: true, preset_b: true })).toBe(2)
  })
})
