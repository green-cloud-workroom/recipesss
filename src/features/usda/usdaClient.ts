import { FDC_MAPPED_NUTRIENT_IDS } from './fdcNutrientMap'
import type {
  FdcFoodDetail,
  FdcFoodSearchItem,
  FdcSearchResponse,
} from './usdaTypes'

const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

function usdaApiKey(): string {
  const key = import.meta.env.VITE_USDA_API_KEY as string | undefined
  if (!key) throw new Error('USDA API 키가 설정되지 않았습니다.')
  return key
}

export async function searchFdcFoods(
  query: string,
): Promise<FdcFoodSearchItem[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    api_key: usdaApiKey(),
    query: trimmed,
    pageSize: '10',
  })
  const response = await fetch(`${FDC_BASE_URL}/foods/search?${params}`)
  if (!response.ok) throw new Error(`USDA 검색 실패 (${response.status})`)
  const data = (await response.json()) as FdcSearchResponse
  return data.foods ?? []
}

export async function fetchFdcFood(fdcId: number): Promise<FdcFoodDetail> {
  const params = new URLSearchParams({
    api_key: usdaApiKey(),
    nutrients: FDC_MAPPED_NUTRIENT_IDS.join(','),
  })
  const response = await fetch(`${FDC_BASE_URL}/food/${fdcId}?${params}`)
  if (!response.ok) throw new Error(`USDA 상세 조회 실패 (${response.status})`)
  return (await response.json()) as FdcFoodDetail
}
