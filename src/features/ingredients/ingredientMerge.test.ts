import { describe, expect, it } from 'vitest'

import { buildIngredientMergePlan } from './ingredientMerge'
import type { Ingredient, Preset, RecipeDraft } from '../../types/recipe'

function ingredient(
  id: string,
  kind: Ingredient['kind'] = 'ingredient',
): Ingredient {
  return {
    id,
    name: id,
    kind,
    displayName: '',
    aliases: [],
    hidden: false,
    sortOrder: 0,
    nutrientProfile: {},
  }
}

function draft(
  id: string,
  ingredientIds: string[],
  unitIngredientId = 'unit',
): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name: id,
    species: 'cat',
    unitIngredientId,
    unitLabel: 'unit',
    composition: ingredientIds.map((ingredientId, index) => ({
      ingredientId,
      weight: 100,
      unit: 'g',
      sortOrder: index,
    })),
    standardId: 'AAFCO_2024_CAT_ADULT',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

function preset(id: string, unitIngredientId: string): Preset {
  return {
    id,
    draftId: 'draft_a',
    code: 'A0',
    targetWeight: 200,
    label: '',
    unitIngredientId,
    inputAmount: 1,
    inputUnitLabel: 'unit',
    sortOrder: 0,
    createdAt: 1,
  }
}

describe('buildIngredientMergePlan', () => {
  it('keeps the first selected ingredient and rewrites draft composition ids', () => {
    const plan = buildIngredientMergePlan({
      drafts: [draft('draft_a', ['ing_a', 'ing_b']), draft('draft_b', ['ing_c'])],
      ingredients: [ingredient('ing_a'), ingredient('ing_b'), ingredient('ing_c')],
      now: 123,
      selectedIds: ['ing_a', 'ing_b'],
      targetName: 'Pumpkin',
    })

    expect(plan.target).toMatchObject({ id: 'ing_a', name: 'Pumpkin' })
    expect(plan.deleteIds).toEqual(['ing_b'])
    expect(plan.changedDrafts).toHaveLength(1)
    // ing_a + ing_b 공존 → 한 행으로 합산 (weight 100+100)
    expect(plan.changedDrafts[0]?.composition).toEqual([
      { ingredientId: 'ing_a', weight: 200, unit: 'g', sortOrder: 0 },
    ])
    expect(plan.changedDrafts[0]?.mergeReviewPending).toBe(true)
    expect(plan.summedDraftIds).toEqual(['draft_a'])
    expect(plan.changedDrafts[0]?.updatedAt).toBe(123)
  })

  it('does not flag review when only a single duplicate row is swapped', () => {
    const plan = buildIngredientMergePlan({
      drafts: [draft('draft_a', ['ing_b', 'ing_c'])],
      ingredients: [ingredient('ing_a'), ingredient('ing_b'), ingredient('ing_c')],
      now: 123,
      selectedIds: ['ing_a', 'ing_b'],
      targetName: 'Pumpkin',
    })

    // ing_a 없음 → ing_b만 ing_a로 치환, 합산 없음
    expect(plan.changedDrafts[0]?.composition.map((row) => row.ingredientId)).toEqual([
      'ing_a',
      'ing_c',
    ])
    expect(plan.changedDrafts[0]?.mergeReviewPending).toBeUndefined()
    expect(plan.summedDraftIds).toEqual([])
  })

  it('collapses multiple duplicates of the target into one summed row', () => {
    const plan = buildIngredientMergePlan({
      drafts: [draft('draft_a', ['ing_b', 'x', 'ing_c'])],
      ingredients: [
        ingredient('ing_a'),
        ingredient('ing_b'),
        ingredient('ing_c'),
        ingredient('x'),
      ],
      now: 9,
      selectedIds: ['ing_a', 'ing_b', 'ing_c'],
      targetName: 'Merged',
    })

    // ing_b, ing_c 둘 다 ing_a로 → 첫 등장(sortOrder 0) 자리에 합산, 'x'는 유지
    expect(plan.changedDrafts[0]?.composition).toEqual([
      { ingredientId: 'ing_a', weight: 200, unit: 'g', sortOrder: 0 },
      { ingredientId: 'x', weight: 100, unit: 'g', sortOrder: 1 },
    ])
    expect(plan.summedDraftIds).toEqual(['draft_a'])
  })

  it('rewrites draft.unitIngredientId when the unit ingredient is merged away', () => {
    const plan = buildIngredientMergePlan({
      drafts: [draft('draft_a', ['ing_a', 'ing_b'], 'ing_b')],
      ingredients: [ingredient('ing_a'), ingredient('ing_b')],
      now: 1,
      selectedIds: ['ing_a', 'ing_b'],
      targetName: 'Merged',
    })

    expect(plan.changedDrafts[0]?.unitIngredientId).toBe('ing_a')
  })

  it('rewrites unitIngredientId even when the duplicate is not in composition', () => {
    const plan = buildIngredientMergePlan({
      drafts: [draft('draft_a', ['x'], 'ing_b')],
      ingredients: [ingredient('ing_a'), ingredient('ing_b'), ingredient('x')],
      now: 1,
      selectedIds: ['ing_a', 'ing_b'],
      targetName: 'Merged',
    })

    expect(plan.changedDrafts).toHaveLength(1)
    expect(plan.changedDrafts[0]?.unitIngredientId).toBe('ing_a')
    expect(plan.changedDrafts[0]?.composition.map((row) => row.ingredientId)).toEqual([
      'x',
    ])
    expect(plan.summedDraftIds).toEqual([])
  })

  it('rewrites preset.unitIngredientId for merged-away ingredients', () => {
    const plan = buildIngredientMergePlan({
      drafts: [],
      ingredients: [ingredient('ing_a'), ingredient('ing_b')],
      presets: [preset('preset_1', 'ing_b'), preset('preset_2', 'other')],
      now: 1,
      selectedIds: ['ing_a', 'ing_b'],
      targetName: 'Merged',
    })

    expect(plan.changedPresets).toHaveLength(1)
    expect(plan.changedPresets[0]).toMatchObject({
      id: 'preset_1',
      unitIngredientId: 'ing_a',
    })
  })

  it('returns no preset changes when presets are not provided', () => {
    const plan = buildIngredientMergePlan({
      drafts: [],
      ingredients: [ingredient('ing_a'), ingredient('ing_b')],
      now: 1,
      selectedIds: ['ing_a', 'ing_b'],
      targetName: 'Merged',
    })

    expect(plan.changedPresets).toEqual([])
  })

  it('rejects merging ingredients with supplements', () => {
    expect(() =>
      buildIngredientMergePlan({
        drafts: [],
        ingredients: [ingredient('ing_a'), ingredient('sup_a', 'supplement')],
        now: 123,
        selectedIds: ['ing_a', 'sup_a'],
        targetName: 'Merged',
      }),
    ).toThrow('원료와 영양제는 서로 병합할 수 없습니다.')
  })

  it('requires at least two ingredients and a target name', () => {
    expect(() =>
      buildIngredientMergePlan({
        drafts: [],
        ingredients: [ingredient('ing_a')],
        now: 123,
        selectedIds: ['ing_a'],
        targetName: 'Merged',
      }),
    ).toThrow('병합할 원료를 2개 이상 선택하세요.')

    expect(() =>
      buildIngredientMergePlan({
        drafts: [],
        ingredients: [ingredient('ing_a'), ingredient('ing_b')],
        now: 123,
        selectedIds: ['ing_a', 'ing_b'],
        targetName: ' ',
      }),
    ).toThrow('병합 후 원료명을 입력하세요.')
  })
})
