import { describe, expect, it } from 'vitest'

import {
  generatePresetCode,
  parseCode,
  pickPrefix,
  pickSuffix,
  preferredPrefixOfDraft,
} from './presetCodes'
import type { Preset, RecipeDraft, Species } from '../../types/recipe'

function draft(
  id: string,
  sortOrder: number,
  species: Species = 'cat',
): RecipeDraft {
  return {
    id,
    ownerUid: 'uid',
    name: id,
    species,
    unitIngredientId: 'ing_unit',
    unitLabel: '개',
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
  sortOrder = 0,
  createdAt = 1,
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
    createdAt,
  }
}

describe('parseCode', () => {
  it('parses uppercase prefix and numeric suffix', () => {
    expect(parseCode('B0')).toEqual({ prefix: 'B', suffix: 0 })
    expect(parseCode('N12')).toEqual({ prefix: 'N', suffix: 12 })
  })

  it('returns null for unsupported formats', () => {
    expect(parseCode('')).toBeNull()
    expect(parseCode('x')).toBeNull()
    expect(parseCode('b0')).toBeNull()
    expect(parseCode('B')).toBeNull()
  })
})

describe('preferredPrefixOfDraft', () => {
  it('returns the most used prefix for a draft', () => {
    expect(
      preferredPrefixOfDraft(
        [
          preset('preset_a0', 'draft_cat', 'A0', 0),
          preset('preset_a1', 'draft_cat', 'A1', 1),
          preset('preset_b0', 'draft_cat', 'B0', 2),
        ],
        'draft_cat',
      ),
    ).toBe('A')
  })

  it('uses first seen prefix as tie breaker after deterministic sort', () => {
    expect(
      preferredPrefixOfDraft(
        [
          preset('preset_b0', 'draft_cat', 'B0', 2),
          preset('preset_a0', 'draft_cat', 'A0', 1),
        ],
        'draft_cat',
      ),
    ).toBe('A')
  })

  it('returns an empty string when the draft has no parseable preset code', () => {
    expect(
      preferredPrefixOfDraft([preset('preset_x', 'draft_cat', 'x')], 'draft_cat'),
    ).toBe('')
  })
})

describe('pickPrefix', () => {
  const drafts = [
    draft('draft_a', 0),
    draft('draft_b', 1),
    draft('draft_c', 2),
  ]

  it('prefers the draft own existing prefix', () => {
    expect(
      pickPrefix([preset('preset_c0', 'draft_b', 'C0')], drafts, 'draft_b'),
    ).toBe('C')
  })

  it('uses the draft sortOrder index for an empty draft', () => {
    expect(pickPrefix([], drafts, 'draft_a')).toBe('A')
    expect(pickPrefix([], drafts, 'draft_b')).toBe('B')
    expect(pickPrefix([], drafts, 'draft_c')).toBe('C')
  })

  it('uses the next free letter when the indexed letter is taken by another draft', () => {
    expect(
      pickPrefix([preset('preset_b0', 'draft_a', 'B0')], drafts, 'draft_b'),
    ).toBe('A')
  })
})

describe('pickSuffix', () => {
  it('returns the next suffix after contiguous values', () => {
    expect(
      pickSuffix(
        [
          preset('preset_a0', 'draft_cat', 'A0'),
          preset('preset_a1', 'draft_cat', 'A1'),
        ],
        'draft_cat',
        'A',
      ),
    ).toBe(2)
  })

  it('returns the smallest missing suffix', () => {
    expect(
      pickSuffix(
        [
          preset('preset_a0', 'draft_cat', 'A0'),
          preset('preset_a2', 'draft_cat', 'A2'),
        ],
        'draft_cat',
        'A',
      ),
    ).toBe(1)
  })

  it('returns zero when no suffix is used', () => {
    expect(pickSuffix([], 'draft_cat', 'A')).toBe(0)
  })
})

describe('generatePresetCode', () => {
  it('generates the first indexed code for an empty draft', () => {
    expect(generatePresetCode([], [draft('draft_cat', 0)], 'draft_cat')).toBe(
      'A0',
    )
  })

  it('continues the existing draft prefix with the next suffix', () => {
    expect(
      generatePresetCode(
        [preset('preset_a0', 'draft_cat', 'A0')],
        [draft('draft_cat', 0)],
        'draft_cat',
      ),
    ).toBe('A1')
  })
})
