import { useQuery } from '@tanstack/react-query'

import { NUTRIENT_META } from '../nutrition/nutrientKeys'
import { fetchFdcFood, searchFdcFoods } from './usdaClient'
import { readUsdaCache, writeUsdaCache } from './usdaCache'
import { mapFdcFood } from './mapFdcFood'
import type { FdcFoodSearchItem, MappedFdcFood } from './usdaTypes'
import type { NutrientKey, NutrientValues } from '../../types/recipe'

export function useUsdaSearch(query: string) {
  const trimmed = query.trim()
  return useQuery<FdcFoodSearchItem[]>({
    queryKey: ['usdaSearch', trimmed],
    queryFn: () => searchFdcFoods(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUsdaFood(fdcId: number | null) {
  return useQuery<MappedFdcFood>({
    queryKey: ['usdaFood', fdcId],
    queryFn: async () => {
      if (fdcId === null) throw new Error('fdcId가 없습니다.')
      const cached = await readUsdaCache(fdcId)
      if (cached) {
        const mappedKeys = nutrientKeys(cached.nutrients)
        return {
          fdcId: cached.fdcId,
          description: cached.description,
          dataType: cached.dataType,
          nutrients: cached.nutrients,
          mappedKeys,
          missingKeys: NUTRIENT_META.map((meta) => meta.key).filter(
            (key) => !mappedKeys.includes(key),
          ),
        }
      }

      const mapped = mapFdcFood(await fetchFdcFood(fdcId))
      await writeUsdaCache({
        fdcId: mapped.fdcId,
        description: mapped.description,
        dataType: mapped.dataType,
        nutrients: mapped.nutrients,
        fetchedAt: Date.now(),
      })
      return mapped
    },
    enabled: fdcId !== null,
    staleTime: Infinity,
  })
}

function nutrientKeys(values: NutrientValues): NutrientKey[] {
  return Object.keys(values) as NutrientKey[]
}
