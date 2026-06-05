import { describe, expect, it } from 'vitest'

import { evaluateDraft, evaluateRatios } from './evaluate'
import { getProfile } from './profiles'
import type { Ingredient, NutrientProfile, RecipeDraft } from '../../types/recipe'

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    id: 'draft_test',
    ownerUid: 'uid',
    name: 'test',
    species: 'dog',
    unitIngredientId: 'ing_a',
    unitLabel: '개',
    composition: [{ ingredientId: 'ing_a', weight: 100, unit: 'g', sortOrder: 0 }],
    standardId: 'TEST',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function ingredient(
  nutrientProfile: Ingredient['nutrientProfile'],
): Record<string, Ingredient> {
  return {
    ing_a: {
      id: 'ing_a',
      name: 'ing_a',
      kind: 'ingredient',
      displayName: 'ing_a',
      aliases: [],
      hidden: false,
      nutrientProfile,
      sortOrder: 0,
    },
  }
}

function profile(overrides: Partial<NutrientProfile> = {}): NutrientProfile {
  return {
    id: 'TEST',
    standard: 'FEDIAF',
    year: 2025,
    species: 'dog',
    lifeStage: 'adult',
    label: 'test',
    perMe: {
      crudeProtein: { min: 50, max: 100 },
      calcium: { min: 2, max: 5 },
    },
    perDm: {
      crudeProtein: { min: 20, max: 40 },
      calcium: { min: 0.8, max: 2 },
    },
    ratios: { caP: { min: 1, max: 2 } },
    ...overrides,
  }
}

describe('evaluateDraft', () => {
  it('marks nutrients as ok on per-ME basis', () => {
    const results = evaluateDraft(
      draft(),
      ingredient({ moisture: 0, crudeProtein: 20, crudeFat: 10, calcium: 1 }),
      profile(),
      'per_1000_kcal_ME',
    )

    expect(results.find((item) => item.nutrient === 'crudeProtein')).toMatchObject({
      status: 'ok',
    })
  })

  it('marks nutrients as deficient with deficit amount', () => {
    const result = evaluateDraft(
      draft(),
      ingredient({ moisture: 0, crudeProtein: 1, crudeFat: 10 }),
      profile(),
      'dry_matter',
    ).find((item) => item.nutrient === 'crudeProtein')

    expect(result).toMatchObject({ status: 'deficient', deficit: 19 })
  })

  it('marks nutrients as excess with excess amount', () => {
    const result = evaluateDraft(
      draft(),
      ingredient({ moisture: 0, crudeProtein: 50, crudeFat: 10 }),
      profile(),
      'dry_matter',
    ).find((item) => item.nutrient === 'crudeProtein')

    expect(result).toMatchObject({ status: 'excess', excess: 10 })
  })

  it('uses different basis data for per-ME and dry matter', () => {
    const ing = ingredient({
      moisture: 0,
      crudeProtein: 20,
      crudeFat: 10,
      calcium: 1,
    })
    const perMe = evaluateDraft(draft(), ing, profile(), 'per_1000_kcal_ME')
    const perDm = evaluateDraft(draft(), ing, profile(), 'dry_matter')

    expect(perMe.find((item) => item.nutrient === 'calcium')?.actual).not.toBe(
      perDm.find((item) => item.nutrient === 'calcium')?.actual,
    )
  })

  it('includes only nutrients defined by the selected profile basis', () => {
    expect(
      evaluateDraft(
        draft(),
        ingredient({ crudeProtein: 20, calcium: 1 }),
        profile({ perDm: { calcium: { min: 0.8 } } }),
        'dry_matter',
      ).map((item) => item.nutrient),
    ).toEqual(['calcium'])
  })

  it('uses declared values before basis conversion', () => {
    const result = evaluateDraft(
      draft({ declaredNutrients: { moisture: 0, crudeProtein: 30, crudeFat: 10 } }),
      ingredient({ moisture: 0, crudeProtein: 1, crudeFat: 10 }),
      profile(),
      'dry_matter',
    ).find((item) => item.nutrient === 'crudeProtein')

    expect(result).toMatchObject({ actual: 30, status: 'ok' })
  })

  it('returns actual zero when no calculated value exists', () => {
    expect(
      evaluateDraft(draft(), ingredient({}), profile(), 'dry_matter')[0],
    ).toMatchObject({ actual: 0, status: 'deficient' })
  })

  it('works with a bundled FEDIAF profile', () => {
    const fediaf = getProfile('FEDIAF_2025_DOG_ADULT_MER95')
    if (!fediaf) throw new Error('Missing FEDIAF profile')

    expect(
      evaluateDraft(
        draft(),
        ingredient({ moisture: 0, crudeProtein: 30, crudeFat: 20, calcium: 1 }),
        fediaf,
        'dry_matter',
      ).length,
    ).toBeGreaterThan(10)
  })
})

describe('evaluateRatios', () => {
  it('marks Ca:P ratio as ok', () => {
    expect(
      evaluateRatios(
        draft(),
        ingredient({ calcium: 1.5, phosphorus: 1 }),
        profile(),
      )[0],
    ).toMatchObject({ ratio: 'caP', actual: 1.5, status: 'ok' })
  })

  it('marks Ca:P ratio as deficient', () => {
    expect(
      evaluateRatios(
        draft(),
        ingredient({ calcium: 0.5, phosphorus: 1 }),
        profile(),
      )[0],
    ).toMatchObject({ status: 'deficient' })
  })

  it('marks Ca:P ratio as excess', () => {
    expect(
      evaluateRatios(
        draft(),
        ingredient({ calcium: 3, phosphorus: 1 }),
        profile(),
      )[0],
    ).toMatchObject({ status: 'excess' })
  })

  it('returns no result when phosphorus is zero', () => {
    expect(
      evaluateRatios(draft(), ingredient({ calcium: 1, phosphorus: 0 }), profile()),
    ).toEqual([])
  })

  it('returns no result when profile has no Ca:P ratio requirement', () => {
    expect(
      evaluateRatios(
        draft(),
        ingredient({ calcium: 1, phosphorus: 1 }),
        profile({ ratios: undefined }),
      ),
    ).toEqual([])
  })
})
