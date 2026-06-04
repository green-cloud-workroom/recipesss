import { describe, expect, it } from 'vitest'

import {
  buildOrderSummary,
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
  unitLabel = '개',
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
    inputUnitLabel: '개',
    sortOrder,
    createdAt: 1,
  }
}

describe('speciesLabel', () => {
  it('returns Korean labels for species values', () => {
    expect(speciesLabel('cat')).toBe('고양이')
    expect(speciesLabel('dog')).toBe('강아지')
    expect(speciesLabel(null)).toBe('미지정')
  })
})

describe('groupLabel', () => {
  it('combines species and draft name', () => {
    expect(groupLabel(draft('draft_cat', '치킨', 'cat', 0))).toBe('(고양이)치킨')
  })
})

describe('groupPresetsByRecipe', () => {
  it('groups presets by draft and sorts drafts and presets by sortOrder', () => {
    const groups = groupPresetsByRecipe(
      [
        draft('draft_dog', '덕', 'dog', 2),
        draft('draft_cat', '치킨', 'cat', 1),
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
        draft('draft_empty', '비어있음', null, 0),
        draft('draft_cat', '치킨', 'cat', 1),
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
      [draft('draft_cat', '치킨', 'cat', 0, '마리')],
      [preset('preset_a', 'draft_cat', 'a0', 0)],
    )

    expect(groups[0]?.species).toBe('cat')
    expect(groups[0]?.unitLabel).toBe('마리')
  })
})

describe('buildOrderSummary', () => {
  const groups: OrderGroup[] = groupPresetsByRecipe(
    [
      draft('draft_cat', '치킨', 'cat', 0, '개'),
      draft('draft_dog', '덕', 'dog', 1, '마리'),
    ],
    [
      preset('preset_a', 'draft_cat', 'a0', 0),
      preset('preset_b', 'draft_cat', 'a1', 1),
      preset('preset_c', 'draft_dog', 'c0', 0),
    ],
  )

  it('includes only selected presets and keeps group/item order', () => {
    const summary = buildOrderSummary(groups, {
      preset_b: 40,
      preset_c: 2,
    })

    expect(summary).toEqual([
      {
        draftId: 'draft_cat',
        label: '(고양이)치킨',
        unitLabel: '개',
        items: [{ code: 'a1', quantity: 40 }],
      },
      {
        draftId: 'draft_dog',
        label: '(강아지)덕',
        unitLabel: '마리',
        items: [{ code: 'c0', quantity: 2 }],
      },
    ])
  })

  it('omits groups with no selected presets', () => {
    expect(buildOrderSummary(groups, { preset_c: 1 })).toHaveLength(1)
  })
})

describe('formatOrderLine', () => {
  it('formats a summary group with units', () => {
    expect(
      formatOrderLine({
        draftId: 'draft_cat',
        label: '(고양이)치킨',
        unitLabel: '개',
        items: [
          { code: 'a0', quantity: 20 },
          { code: 'a1', quantity: 40 },
        ],
      }),
    ).toBe('(고양이)치킨  a0 20개 / a1 40개')
  })

  it('formats a summary group without units', () => {
    expect(
      formatOrderLine({
        draftId: 'draft_cat',
        label: '(고양이)치킨',
        unitLabel: '',
        items: [{ code: 'a0', quantity: 20 }],
      }),
    ).toBe('(고양이)치킨  a0 20')
  })
})

describe('totalSelectedCount', () => {
  it('counts selected preset ids', () => {
    expect(totalSelectedCount({ preset_a: 0, preset_b: 20 })).toBe(2)
  })
})
