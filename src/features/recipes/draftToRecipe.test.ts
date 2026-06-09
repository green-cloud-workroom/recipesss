import { describe, expect, it } from 'vitest'

import { draftToRecipe, speciesToTarget } from './draftToRecipe'
import type { IngredientMap } from '../nutrition/calc'
import type { Ingredient, RecipeDraft, Species } from '../../types/recipe'

function ingredient(id: string, kind: Ingredient['kind']): Ingredient {
  return {
    id,
    name: `name_${id}`,
    kind,
    displayName: '',
    aliases: [],
    hidden: false,
    sortOrder: 0,
    nutrientProfile: {},
  }
}

function draft(species: Species = 'cat'): RecipeDraft {
  return {
    id: 'draft_a',
    ownerUid: 'uid',
    name: '치킨레시피',
    species,
    unitIngredientId: 'ing_unit',
    unitLabel: '마리',
    composition: [
      { ingredientId: 'ing_unit', weight: 1000, unit: 'g', sortOrder: 0 },
      { ingredientId: 'ing_rice', weight: 200, unit: 'g', sortOrder: 1 },
      { ingredientId: 'sup_vit', weight: 5, unit: 'g', sortOrder: 2 },
    ],
    standardId: 'AAFCO_2024_CAT_ADULT',
    status: 'draft',
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

const map: IngredientMap = {
  ing_unit: ingredient('ing_unit', 'ingredient'),
  ing_rice: ingredient('ing_rice', 'ingredient'),
  sup_vit: ingredient('sup_vit', 'supplement'),
}

describe('speciesToTarget', () => {
  it('maps cat/dog/null', () => {
    expect(speciesToTarget('cat')).toBe('cat')
    expect(speciesToTarget('dog')).toBe('dog')
    expect(speciesToTarget(null)).toBe('common')
  })
})

describe('draftToRecipe', () => {
  it('excludes supplements and maps to production ingredient rows', () => {
    const payload = draftToRecipe(draft(), map, 'owner_uid')

    expect(payload.ingredients.map((row) => row.id)).toEqual([
      'ing_unit',
      'ing_rice',
    ])
    const unitRow = payload.ingredients[0]
    expect(unitRow).toMatchObject({
      id: 'ing_unit',
      name: 'name_ing_unit',
      baseWeightG: 1000,
      unitName: 'g',
      isProductionUnit: true,
      autoDeductInventory: false,
      linkedToInventory: false,
    })
    expect(payload.ingredients[1]?.isProductionUnit).toBe(false)
  })

  it('sets the partial-create register contract fields', () => {
    const payload = draftToRecipe(draft('dog'), map, 'owner_uid')
    expect(payload).toMatchObject({
      name: '치킨레시피',
      displayName: '치킨레시피',
      target: 'dog',
      category: 'raw',
      active: false,
      version: 1,
      sortOrder: 0,
      unitPresets: [],
      source: 'recipesss',
      recipesssDraftId: 'draft_a',
      createdBy: 'owner_uid',
    })
  })
})
