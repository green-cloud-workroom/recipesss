import { describe, expect, it } from 'vitest'

import {
  filledNutrientCount,
  filterIngredients,
  groupByKind,
} from './ingredientSelectors'
import type { Ingredient } from '../../types/recipe'

function ingredient(
  id: string,
  kind: Ingredient['kind'],
  sortOrder: number,
  overrides: Partial<Ingredient> = {},
): Ingredient {
  return {
    id,
    name: id,
    kind,
    displayName: id,
    aliases: [],
    hidden: false,
    sortOrder,
    ...overrides,
  }
}

const items = [
  ingredient('salmon', 'ingredient', 2, {
    displayName: '연어',
    aliases: ['fish'],
  }),
  ingredient('vitamin_e', 'supplement', 1, {
    displayName: '비타민E',
  }),
  ingredient('chicken', 'ingredient', 0, {
    displayName: '닭',
  }),
]

describe('filterIngredients', () => {
  it('returns all items for an empty query', () => {
    expect(filterIngredients(items, '')).toHaveLength(3)
  })

  it('matches by name only, case-insensitively (not displayName/aliases)', () => {
    expect(filterIngredients(items, 'SAL').map((item) => item.id)).toEqual([
      'salmon',
    ])
    // displayName(치환명)·aliases로는 검색되지 않음
    expect(filterIngredients(items, '비타민')).toHaveLength(0)
    expect(filterIngredients(items, 'fish')).toHaveLength(0)
  })
})

describe('groupByKind', () => {
  it('groups ingredients by kind and sorts each group by sortOrder', () => {
    expect(groupByKind(items)).toEqual({
      ingredient: [items[2], items[0]],
      supplement: [items[1]],
    })
  })
})

describe('filledNutrientCount', () => {
  it('counts defined nutrient values', () => {
    expect(
      filledNutrientCount({
        crudeProtein: 20,
        calcium: 0,
      }),
    ).toBe(2)
  })

  it('returns zero for an empty or missing profile', () => {
    expect(filledNutrientCount({})).toBe(0)
    expect(filledNutrientCount(undefined)).toBe(0)
  })
})
