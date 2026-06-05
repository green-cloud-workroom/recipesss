import { describe, expect, it } from 'vitest'

import {
  effectiveNutrient,
  effectiveNutrients,
  syncDeclaredFromCalculated,
} from './declared'
import type { Ingredient, RecipeDraft } from '../../types/recipe'

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    id: 'draft_test',
    ownerUid: 'uid',
    name: 'test',
    species: 'dog',
    unitIngredientId: 'ing_a',
    unitLabel: '개',
    composition: [{ ingredientId: 'ing_a', weight: 100, unit: 'g', sortOrder: 0 }],
    standardId: 'FEDIAF_2025_DOG_ADULT_MER95',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

const ingredients: Record<string, Ingredient> = {
  ing_a: {
    id: 'ing_a',
    name: 'ing_a',
    kind: 'ingredient',
    displayName: 'ing_a',
    aliases: [],
    hidden: false,
    nutrientProfile: { crudeProtein: 20, calcium: 1 },
    sortOrder: 0,
  },
}

describe('syncDeclaredFromCalculated', () => {
  it('copies calculated nutrients into declared nutrients', () => {
    expect(syncDeclaredFromCalculated(draft(), ingredients, 123)).toMatchObject({
      declaredNutrients: { crudeProtein: 20, calcium: 1 },
      declaredNutrientsUpdatedAt: 123,
    })
  })

  it('does not mutate the original draft', () => {
    const original = draft()
    syncDeclaredFromCalculated(original, ingredients, 123)
    expect(original.declaredNutrients).toBeUndefined()
  })
})

describe('effectiveNutrient', () => {
  it('prefers declared nutrient values', () => {
    expect(
      effectiveNutrient(
        draft({ declaredNutrients: { crudeProtein: 25 } }),
        ingredients,
        'crudeProtein',
      ),
    ).toBe(25)
  })

  it('falls back to calculated values', () => {
    expect(effectiveNutrient(draft(), ingredients, 'crudeProtein')).toBe(20)
  })

  it('preserves explicit zero declared values', () => {
    expect(
      effectiveNutrient(
        draft({ declaredNutrients: { crudeProtein: 0 } }),
        ingredients,
        'crudeProtein',
      ),
    ).toBe(0)
  })

  it('returns undefined when neither declared nor calculated value exists', () => {
    expect(effectiveNutrient(draft(), ingredients, 'phosphorus')).toBeUndefined()
  })
})

describe('effectiveNutrients', () => {
  it('overlays declared values on top of calculated totals', () => {
    expect(
      effectiveNutrients(
        draft({ declaredNutrients: { crudeProtein: 22, phosphorus: 0.8 } }),
        ingredients,
      ),
    ).toMatchObject({ crudeProtein: 22, calcium: 1, phosphorus: 0.8 })
  })
})
