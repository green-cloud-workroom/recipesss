// 구 recipesss v2 상태 스키마 (SPEC §11.1).
// backups/2026-06-03-pre-rewrite.json 의 실제 구조를 기준으로 작성.
// 이 타입들은 마이그레이션 입력 전용 — 신규 코드에서 직접 쓰지 말 것.

import type { Species, WeightUnit } from '../../types/recipe'

export type V2Composition = {
  ingredientId: string
  weight: number
  unit: WeightUnit
}

export type V2Product = {
  id: string // 'prod_xxxxxxxx'
  name: string
  species: Species
  unitLabel: string // 빈 문자열 가능
  unitIngredientId: string
  composition: V2Composition[] // 배열 순서 = 표시 순서 (sortOrder 필드 없음)
}

export type V2Ingredient = {
  id: string // 'ing_xxxxxxxx'
  name: string
  kind: 'ingredient' | 'supplement'
  displayName: string // 빈 문자열 가능
  aliases: string[]
  // v2엔 hidden / nutrientProfile / sortOrder / source 없음
}

export type V2Preset = {
  id: string // 'preset_xxxxxxxx'
  productId: string // 'prod_xxxxxxxx' (v3에선 draftId 로 변환)
  code: string
  targetWeight: number
  label: string
  unitIngredientId: string
  // ⚠️ 일부 v2 preset 레코드엔 이 두 필드가 아예 없음(미설정 발주). optional.
  inputAmount?: number
  inputUnitLabel?: string
  // v2엔 sortOrder / createdAt 없음
}

export type V2Price = {
  price: number
  unit: number
}

// 구 앱 "백업 다운로드" JSON 전체 형태.
// products / ingredients / presets / prices 는 id 를 키로 갖는 맵.
export type V2State = {
  version: number
  meta?: { savedAt: number }
  products: Record<string, V2Product>
  ingredients: Record<string, V2Ingredient>
  presets: Record<string, V2Preset>
  prices: Record<string, V2Price> // 키 = ingredientId
  productOrder: string[] // product id 정렬 배열
  orderQuantities?: Record<string, unknown>
  ui?: unknown
}
