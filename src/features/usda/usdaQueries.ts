import { useQuery } from '@tanstack/react-query'

import { fetchFdcFood, searchFdcFoods } from './usdaClient'
import { readUsdaCache, writeUsdaCache } from './usdaCache'
import { mapFdcFood, missingNutrientKeys } from './mapFdcFood'
import type { FdcFoodSearchItem, MappedFdcFood } from './usdaTypes'
import type { NutrientKey, NutrientValues } from '../../types/recipe'
import type { UsdaCacheEntry } from '../../types/recipe'

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
        return {
          fdcId: cached.fdcId,
          description: cached.description,
          dataType: cached.dataType,
          nutrients: cached.nutrients,
          mappedKeys: nutrientKeys(cached.nutrients),
          missingKeys: missingNutrientKeys(cached.nutrients),
        }
      }

      const mapped = mapFdcFood(await fetchFdcFood(fdcId))
      // Firestore는 undefined 필드를 거부 → dataType 있을 때만 포함.
      const entry: UsdaCacheEntry = {
        fdcId: mapped.fdcId,
        description: mapped.description,
        nutrients: mapped.nutrients,
        fetchedAt: Date.now(),
        ...(mapped.dataType !== undefined ? { dataType: mapped.dataType } : {}),
      }
      await writeUsdaCache(entry)
      return mapped
    },
    enabled: fdcId !== null,
    staleTime: Infinity,
  })
}

function nutrientKeys(values: NutrientValues): NutrientKey[] {
  return Object.keys(values) as NutrientKey[]
}
