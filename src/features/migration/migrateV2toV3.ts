// v2 → v3 스키마 변환 (SPEC §11.1). 순수 함수 — Firebase·React·부수효과 없음.
// 입력: 구 앱 백업 JSON (V2State). 출력: 컬렉션별 v3 문서 배열.
// 후속 0.5-B 마이그레이션 스크립트가 이 결과를 fant-e5ae5 에 write.

import type {
  Ingredient,
  Preset,
  Price,
  RecipeDraft,
  Species,
} from '../../types/recipe'
import type { V2State } from './v2State'

export type MigrationResult = {
  version: 3
  recipeDrafts: RecipeDraft[]
  ingredients: Ingredient[]
  presets: Preset[]
  prices: Record<string, Price> // DL-024: 별도 인터페이스 미정 — v2 값 그대로 보존
}

export type MigrationOptions = {
  ownerUid: string // 변환된 draft 의 소유자. v2엔 없으므로 외부 주입.
  now: number // createdAt/updatedAt 기준 시각. 결정적 테스트 위해 주입.
  // standardId 기본 정책. v2엔 standardId 개념이 없으므로 species 기반 기본값 부여.
  // 단계 1(AAFCO 적재) 전이라 화면에서 다시 선택 가능. override 가능.
  defaultStandardId?: (species: Species) => string
}

// 기본 standardId: species 기반 성체(adult) 표준. null 종은 빈 문자열(사용자 선택).
function defaultStandardIdFor(species: Species): string {
  if (species === 'cat') return 'AAFCO_2014_CAT_ADULT'
  if (species === 'dog') return 'AAFCO_2014_DOG_ADULT'
  return ''
}

// 'prod_xxxx' → 'draft_xxxx'. prefix 가 다르면 그대로 둔다(방어적).
function prodIdToDraftId(productId: string): string {
  return productId.startsWith('prod_')
    ? `draft_${productId.slice('prod_'.length)}`
    : productId
}

export function migrateV2toV3(
  v2: V2State,
  options: MigrationOptions,
): MigrationResult {
  const { ownerUid, now } = options
  const resolveStandardId = options.defaultStandardId ?? defaultStandardIdFor

  // recipeDrafts: products → drafts. sortOrder 는 productOrder 순서를 따르고,
  // productOrder 에 없는 product 는 맵 순서로 뒤에 append.
  const productOrder = v2.productOrder ?? []
  const orderedProductIds: string[] = [
    ...productOrder.filter((id) => id in v2.products),
    ...Object.keys(v2.products).filter((id) => !productOrder.includes(id)),
  ]

  const recipeDrafts: RecipeDraft[] = orderedProductIds.map(
    (productId, index) => {
      const product = v2.products[productId]!
      return {
        id: prodIdToDraftId(product.id),
        ownerUid,
        name: product.name,
        species: product.species,
        unitIngredientId: product.unitIngredientId,
        unitLabel: product.unitLabel,
        composition: product.composition.map((row, rowIndex) => ({
          ingredientId: row.ingredientId,
          weight: row.weight,
          unit: row.unit,
          sortOrder: rowIndex,
        })),
        standardId: resolveStandardId(product.species),
        status: 'draft', // SPEC §11.1: 모두 draft
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      }
    },
  )

  // ingredients: 그대로 + hidden/sortOrder 부여 + nutrientProfile 빈 객체 초기화.
  // 영양제(supplement)도 그대로 보존 — 제외는 등록(draftToRecipe) 시에만 (DL-025).
  const ingredients: Ingredient[] = Object.values(v2.ingredients).map(
    (ing, index) => ({
      id: ing.id,
      name: ing.name,
      kind: ing.kind,
      displayName: ing.displayName,
      aliases: ing.aliases,
      hidden: false,
      nutrientProfile: {}, // SPEC §11.1: 빈 객체로 초기화 (단계 1·2에서 채움)
      sortOrder: index,
    }),
  )

  // presets: 그대로 + sortOrder/createdAt 부여 + productId → draftId 변환.
  const presets: Preset[] = Object.values(v2.presets).map((preset, index) => ({
    id: preset.id,
    draftId: prodIdToDraftId(preset.productId),
    code: preset.code,
    targetWeight: preset.targetWeight,
    label: preset.label,
    unitIngredientId: preset.unitIngredientId,
    // 일부 v2 preset 은 이 필드가 누락 → 미설정으로 정규화 (Firestore undefined 거부 방지).
    inputAmount: preset.inputAmount ?? 0,
    inputUnitLabel: preset.inputUnitLabel ?? '',
    sortOrder: index,
    createdAt: now,
  }))

  // prices: DL-024 — 별도 처리. v2 값(키 = ingredientId)을 그대로 보존만 한다.
  const prices: Record<string, Price> = {}
  for (const [ingredientId, price] of Object.entries(v2.prices ?? {})) {
    prices[ingredientId] = { price: price.price, unit: price.unit }
  }

  return { version: 3, recipeDrafts, ingredients, presets, prices }
}
