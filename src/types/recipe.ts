// v3 도메인 모델 (SPEC §4). 스키마 버전 v3.
// v2 → v3 변환은 src/features/migration/* 참조 (SPEC §11.1).

export type Species = 'cat' | 'dog' | null

export type WeightUnit = 'g' | 'kg'

export type IngredientKind = 'ingredient' | 'supplement'

// 영양소 키 enum (SPEC §4.4: 일반성분·아미노산·지방산·미네랄·비타민).
// ⚠️ 단계 1(영양 엔진)에서 전체 키 셋 확정 예정. 현재는 ME 계산(§6.1)에 쓰이는
// 일반성분 골격만 둠. erasableSyntaxOnly 제약으로 enum 대신 union 사용.
// 마이그레이션(0.5-A)은 nutrientProfile을 빈 객체 {}로만 채우므로 키 셋과 무관.
export type NutrientKey =
  | 'crudeProtein'
  | 'crudeFat'
  | 'crudeFiber'
  | 'ash'
  | 'moisture'
  | 'nfe'

export type NutrientValues = Partial<Record<NutrientKey, number>>

// SPEC §4.1 CompositionRow
export type CompositionRow = {
  ingredientId: string
  weight: number // g 기준 항상
  unit: WeightUnit // 표시용
  sortOrder: number // 드래그&드롭 정렬
}

// SPEC §4.1 RecipeDraft (recipesss 전용)
export type RecipeDraft = {
  id: string // 'draft_xxxxxxxx'
  ownerUid: string // 호두님 uid
  name: string
  species: Species
  unitIngredientId: string // 생산단위 기준 원료
  unitLabel: string // 예: '마리'
  composition: CompositionRow[]
  standardId: string // NutrientProfile id (예: AAFCO_2024_CAT_ADULT)
  status: 'draft' | 'inactive' // inactive = 사용 중단 (목록 필터)
  sortOrder: number // 드래그&드롭 정렬
  // 영양값 (DL-027): 계산값은 자동 계산하므로 저장 X, 확정값만 저장.
  declaredNutrients?: NutrientValues
  declaredNutrientsUpdatedAt?: number
  createdAt: number
  updatedAt: number
  // 등록 후 추적용
  registeredRecipeId?: string
  registeredAt?: number
}

// SPEC §4.2 Recipe (생산관리앱 공유 — 등록된 레시피). 영양제 없음 (DL-025).
export type Recipe = {
  id: string
  name: string
  species: Species
  composition: Array<{
    ingredientId: string
    weight: number
    unit: WeightUnit
  }>
  unitLabel: string
  sortOrder: number
  createdBy: string
  source: 'recipesss' | 'production-app'
  recipesssDraftId?: string
  createdAt: number
}

// SPEC §4.3 Ingredient (원료 마스터)
export type Ingredient = {
  id: string // 'ing_xxxxxxxx'
  name: string
  kind: IngredientKind
  displayName: string // 치환명 (선택, 빈 문자열 가능)
  aliases: string[]
  hidden: boolean
  nutrientProfile?: NutrientValues // 100g 당 영양값 (USDA import or 수동)
  source?: {
    type: 'usda' | 'manual'
    fdcId?: number
    importedAt?: number
  }
  vendor?: { name: string; url?: string }
  moistureBasis?: 'as-fed' | 'dry-matter'
  sortOrder: number // 드래그&드롭 정렬
}

// SPEC §4.7 Preset (draftId 참조)
export type Preset = {
  id: string // 'preset_xxxxxxxx'
  draftId: string // recipeDrafts 참조 (등록 후엔 recipes id로 변경)
  code: string // 예: 'A0'
  targetWeight: number // g
  label: string
  unitIngredientId: string
  inputAmount: number
  inputUnitLabel: string
  sortOrder: number // 드래그&드롭 정렬
  createdAt: number
}

// SPEC §4.8 Price (별도 인터페이스 미정 — DL-024).
// 단계 5에서 생산관리앱과 협의 후 확정. 마이그레이션은 v2 값을 그대로 보존만.
export type Price = {
  price: number
  unit: number
}
