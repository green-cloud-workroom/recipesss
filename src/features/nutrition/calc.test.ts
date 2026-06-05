import { describe, expect, it } from 'vitest'

import {
  meKcalPer100g,
  nfeGPer100g,
  per1000kcalME,
  perKgDryMatter,
  sumRecipeNutrients,
  totalDryMatterG,
  totalMeKcal,
  totalWeightG,
} from './calc'
import type { Ingredient, RecipeDraft } from '../../types/recipe'

function draft(composition: RecipeDraft['composition']): RecipeDraft {
  return {
    id: 'draft_test',
    ownerUid: 'uid',
    name: 'test',
    species: 'dog',
    unitIngredientId: 'ing_a',
    unitLabel: '개',
    composition,
    standardId: 'FEDIAF_2025_DOG_ADULT_MER95',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

function ingredient(
  id: string,
  nutrientProfile?: Ingredient['nutrientProfile'],
): Ingredient {
  return {
    id,
    name: id,
    kind: 'ingredient',
    displayName: id,
    aliases: [],
    hidden: false,
    nutrientProfile,
    sortOrder: 0,
  }
}

describe('nfeGPer100g', () => {
  it('calculates NFE from dry matter minus known proximate values', () => {
    expect(
      nfeGPer100g({
        moisture: 10,
        crudeProtein: 20,
        crudeFat: 10,
        crudeFiber: 5,
        ash: 5,
      }),
    ).toBe(50)
  })

  it('treats missing proximate values as zero', () => {
    expect(nfeGPer100g({ moisture: 10 })).toBe(90)
  })

  it('clamps negative NFE to zero', () => {
    expect(nfeGPer100g({ moisture: 20, crudeProtein: 90 })).toBe(0)
  })

  it('handles an empty nutrient object', () => {
    expect(nfeGPer100g({})).toBe(100)
  })
})

describe('meKcalPer100g', () => {
  it('uses modified Atwater factors', () => {
    expect(
      meKcalPer100g({
        moisture: 10,
        crudeProtein: 20,
        crudeFat: 10,
        crudeFiber: 5,
        ash: 5,
      }),
    ).toBe(330)
  })

  it('uses calculated NFE when nfe field is absent', () => {
    expect(meKcalPer100g({ crudeProtein: 10, crudeFat: 10 })).toBe(400)
  })

  it('returns zero when every energy source is zero and moisture is 100', () => {
    expect(meKcalPer100g({ moisture: 100 })).toBe(0)
  })
})

describe('recipe totals', () => {
  const ingredients = {
    ing_a: ingredient('ing_a', {
      moisture: 10,
      crudeProtein: 20,
      crudeFat: 10,
      calcium: 1,
    }),
    ing_b: ingredient('ing_b', {
      moisture: 20,
      crudeProtein: 30,
      crudeFat: 5,
      calcium: 2,
    }),
    ing_empty: ingredient('ing_empty'),
  }

  it('sums nutrient values by row weight', () => {
    expect(
      sumRecipeNutrients(
        draft([
          { ingredientId: 'ing_a', weight: 200, unit: 'g', sortOrder: 0 },
          { ingredientId: 'ing_b', weight: 100, unit: 'g', sortOrder: 1 },
        ]),
        ingredients,
      ),
    ).toMatchObject({
      moisture: 40,
      crudeProtein: 70,
      crudeFat: 25,
      calcium: 4,
    })
  })

  it('skips missing ingredients', () => {
    expect(
      sumRecipeNutrients(
        draft([{ ingredientId: 'missing', weight: 100, unit: 'g', sortOrder: 0 }]),
        ingredients,
      ),
    ).toEqual({})
  })

  it('skips ingredients with no nutrientProfile', () => {
    expect(
      sumRecipeNutrients(
        draft([{ ingredientId: 'ing_empty', weight: 100, unit: 'g', sortOrder: 0 }]),
        ingredients,
      ),
    ).toEqual({})
  })

  it('sums total recipe weight', () => {
    expect(
      totalWeightG(
        draft([
          { ingredientId: 'ing_a', weight: 200, unit: 'g', sortOrder: 0 },
          { ingredientId: 'ing_b', weight: 125, unit: 'g', sortOrder: 1 },
        ]),
      ),
    ).toBe(325)
  })

  it('calculates total dry matter from ingredient moisture', () => {
    expect(
      totalDryMatterG(
        draft([
          { ingredientId: 'ing_a', weight: 200, unit: 'g', sortOrder: 0 },
          { ingredientId: 'ing_b', weight: 100, unit: 'g', sortOrder: 1 },
        ]),
        ingredients,
      ),
    ).toBe(260)
  })

  it('calculates total ME per ingredient before summing', () => {
    expect(
      totalMeKcal(
        draft([{ ingredientId: 'ing_a', weight: 200, unit: 'g', sortOrder: 0 }]),
        ingredients,
      ),
    ).toBe(730)
  })
})

describe('basis conversion', () => {
  it('converts totals to per 1000 kcal ME', () => {
    expect(per1000kcalME({ calcium: 2 }, 500).calcium).toBe(4)
  })

  it('returns an empty object when total ME is zero', () => {
    expect(per1000kcalME({ calcium: 2 }, 0)).toEqual({})
  })

  it('converts totals to per 100 g dry matter', () => {
    expect(perKgDryMatter({ calcium: 2 }, 250).calcium).toBe(0.8)
  })

  it('returns an empty object when dry matter is zero', () => {
    expect(perKgDryMatter({ calcium: 2 }, 0)).toEqual({})
  })
})
