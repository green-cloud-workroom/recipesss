import type { NutrientKey, NutrientValues } from '../../types/recipe'

export type FdcFoodSearchItem = {
  fdcId: number
  description: string
  dataType?: string
  brandOwner?: string
}

export type FdcSearchResponse = {
  foods?: FdcFoodSearchItem[]
  totalHits?: number
  currentPage?: number
  totalPages?: number
}

// 페이지네이션 결과 (더 보기용).
export type FdcSearchPage = {
  foods: FdcFoodSearchItem[]
  pageNumber: number
  totalHits: number
  hasMore: boolean
}

export type FdcFoodNutrient = {
  amount?: number
  nutrient?: {
    id?: number
    number?: string
    name?: string
    unitName?: string
  }
}

export type FdcFoodDetail = {
  fdcId: number
  description: string
  dataType?: string
  foodNutrients?: FdcFoodNutrient[]
}

export type MappedFdcFood = {
  fdcId: number
  description: string
  dataType?: string
  nutrients: NutrientValues
  mappedKeys: NutrientKey[]
  missingKeys: NutrientKey[]
}
