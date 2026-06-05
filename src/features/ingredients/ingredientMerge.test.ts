import { describe, expect, it } from 'vitest'

import { buildIngredientMergePlan } from './ingredientMerge'
import type { Ingredient, RecipeDraft } from '../../types/recipe'

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

function draft(id: string, ingredientIds: string[]): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name: id,
    species: 'cat',
    unitIngredientId: 'unit',
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
    expect(plan.changedDrafts[0]?.composition.map((row) => row.ingredientId))
      .toEqual(['ing_a', 'ing_a'])
    expect(plan.changedDrafts[0]?.updatedAt).toBe(123)
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
