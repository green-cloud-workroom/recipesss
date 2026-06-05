import { z } from 'zod'

import { NUTRIENT_META } from '../nutrition/nutrientKeys'
import type { NutrientKey, NutrientValues } from '../../types/recipe'

const nutrientNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined
    return value
  },
  z.coerce.number().nonnegative('0 이상이어야 합니다.').optional(),
)

const shape = Object.fromEntries(
  NUTRIENT_META.map((meta) => [meta.key, nutrientNumber]),
) as Record<NutrientKey, typeof nutrientNumber>

export const nutrientProfileFormSchema = z
  .object(shape)
  .transform((values): NutrientValues => {
    const profile: NutrientValues = {}
    for (const meta of NUTRIENT_META) {
      const value = values[meta.key]
      if (value !== undefined) profile[meta.key] = value
    }
    return profile
  })

export type NutrientProfileFormInput = z.input<
  typeof nutrientProfileFormSchema
>

export type NutrientProfileFormValues = z.infer<
  typeof nutrientProfileFormSchema
>

export function defaultNutrientProfileFormValues(
  profile: NutrientValues | undefined,
): NutrientProfileFormInput {
  const values: NutrientProfileFormInput = {}
  for (const meta of NUTRIENT_META) {
    values[meta.key] = profile?.[meta.key] ?? ''
  }
  return values
}
