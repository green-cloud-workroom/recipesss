import { useQuery } from '@tanstack/react-query'

import type {
  NutrientKey,
  NutrientValues,
  UsdaCacheEntry,
} from '../../types/recipe'
import { mapFdcFood, missingNutrientKeys } from './mapFdcFood'
import { fetchFdcFood, searchFdcFoods } from './usdaClient'
import { readUsdaCache, writeUsdaCache } from './usdaCache'
import type { FdcFoodSearchItem, MappedFdcFood } from './usdaTypes'

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

      const cached = await safeReadUsdaCache(fdcId)
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
      // Firestore rejects undefined fields, so include dataType only when present.
      const entry: UsdaCacheEntry = {
        fdcId: mapped.fdcId,
        description: mapped.description,
        nutrients: mapped.nutrients,
        fetchedAt: Date.now(),
        ...(mapped.dataType !== undefined ? { dataType: mapped.dataType } : {}),
      }
      await safeWriteUsdaCache(entry)
      return mapped
    },
    enabled: fdcId !== null,
    staleTime: Infinity,
  })
}

function nutrientKeys(values: NutrientValues): NutrientKey[] {
  return Object.keys(values) as NutrientKey[]
}

async function safeReadUsdaCache(
  fdcId: number,
): Promise<UsdaCacheEntry | null> {
  try {
    return await readUsdaCache(fdcId)
  } catch (err) {
    console.warn('USDA cache read skipped.', err)
    return null
  }
}

async function safeWriteUsdaCache(entry: UsdaCacheEntry): Promise<void> {
  try {
    await writeUsdaCache(entry)
  } catch (err) {
    console.warn('USDA cache write skipped.', err)
  }
}
