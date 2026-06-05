import type {
  NutrientKey,
  NutrientProfile,
  NutrientRequirement,
  NutrientValues,
  RecipeDraft,
} from '../../types/recipe'
import {
  per1000kcalME,
  perKgDryMatter,
  totalDryMatterGFromTotals,
  totalMeKcalFromTotals,
  totalWeightG,
  type IngredientMap,
} from './calc'
import { effectiveNutrients } from './declared'

export type AdequacyStatus = 'ok' | 'deficient' | 'excess'
export type Basis = 'per_1000_kcal_ME' | 'dry_matter'

export type AdequacyResult = {
  nutrient: NutrientKey
  actual: number
  min?: number
  max?: number
  status: AdequacyStatus
  deficit?: number
  excess?: number
}

export type RatioResult = {
  ratio: 'caP'
  actual: number
  min?: number
  max?: number
  status: AdequacyStatus
}

export function evaluateDraft(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile,
  basis: Basis,
): AdequacyResult[] {
  const totals = effectiveNutrients(draft, ingredients)
  const normalized = normalizeForBasis(draft, totals, basis)
  const requirements =
    basis === 'per_1000_kcal_ME' ? profile.perMe : profile.perDm

  return Object.entries(requirements).flatMap(([key, requirement]) => {
    if (requirement === undefined) return []
    const nutrient = key as NutrientKey
    return [
      evaluateRequirement(
        nutrient,
        normalized[nutrient] ?? 0,
        requirement,
      ),
    ]
  })
}

export function evaluateRatios(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile,
): RatioResult[] {
  const requirement = profile.ratios?.caP
  if (!requirement) return []

  const totals = effectiveNutrients(draft, ingredients)
  const calcium = totals.calcium ?? 0
  const phosphorus = totals.phosphorus ?? 0
  if (phosphorus <= 0) return []

  const actual = calcium / phosphorus
  const status = statusFor(actual, requirement.min, requirement.max)

  return [
    {
      ratio: 'caP',
      actual,
      min: requirement.min,
      max: requirement.max,
      status,
    },
  ]
}

function normalizeForBasis(
  draft: RecipeDraft,
  totals: NutrientValues,
  basis: Basis,
): NutrientValues {
  if (basis === 'per_1000_kcal_ME') {
    return per1000kcalME(
      totals,
      totalMeKcalFromTotals(totals, totalWeightG(draft)),
    )
  }

  return perKgDryMatter(
    totals,
    totalDryMatterGFromTotals(totals, totalWeightG(draft)),
  )
}

function evaluateRequirement(
  nutrient: NutrientKey,
  actual: number,
  requirement: NutrientRequirement,
): AdequacyResult {
  const status = statusFor(actual, requirement.min, requirement.max)

  return {
    nutrient,
    actual,
    min: requirement.min,
    max: requirement.max,
    status,
    ...(status === 'deficient' ? { deficit: requirement.min - actual } : {}),
    ...(status === 'excess' && requirement.max !== undefined
      ? { excess: actual - requirement.max }
      : {}),
  }
}

function statusFor(
  actual: number,
  min: number,
  max: number | undefined,
): AdequacyStatus {
  if (actual < min) return 'deficient'
  if (max !== undefined && actual > max) return 'excess'
  return 'ok'
}
