// schema.js — v2 데이터 모델 정의와 ID 생성
//
// 책임: 빈 state 만들기, ID 생성, 엔티티 팩토리 함수
// 의존: 없음 (가장 아래 계층)

export const SCHEMA_VERSION = 2;

// ID prefix는 디버깅용. console에서 "prod_xxx"만 봐도 종류 파악.
const PREFIXES = {
  product: "prod",
  ingredient: "ing",
  preset: "preset",
  snapshot: "snap"
};

export function makeId(kind) {
  const prefix = PREFIXES[kind] || "id";
  // 충돌 가능성 매우 낮음 (36^8 ≈ 2.8조)
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyState() {
  return {
    version: SCHEMA_VERSION,
    meta: { savedAt: Date.now() },
    ingredients: {},     // id → ingredient
    products: {},        // id → product
    productOrder: [],    // [productId] — 표시 순서
    prices: {},          // ingredientId → { unit, price }
    presets: {},         // id → preset
    orderQuantities: {}, // "presetId__ingredientId" → 수량
    ui: {
      selectedProductIds: [],
      selectedPresetIds: [],
      resultOptions: {}, // productId → { unitIngredientId, weight, supplementOnly, presetLabel }
      editingProductId: null,
      activeTab: "recipe"
    }
  };
}

export function createIngredient({ name = "", kind = "ingredient", displayName = "", aliases = [] } = {}) {
  return {
    id: makeId("ingredient"),
    name: String(name).trim(),
    kind: kind === "supplement" ? "supplement" : "ingredient",
    displayName: String(displayName).trim(),
    aliases: Array.isArray(aliases) ? aliases.map(String) : []
  };
}

export function createProduct({ name = "", species = null, unitIngredientId = "", unitLabel = "", composition = [] } = {}) {
  return {
    id: makeId("product"),
    name: String(name).trim(),
    species: species === "cat" || species === "dog" ? species : null,
    unitIngredientId: String(unitIngredientId || ""),
    unitLabel: String(unitLabel || ""),
    composition: Array.isArray(composition) ? composition.map(normalizeCompositionRow) : []
  };
}

export function normalizeCompositionRow(row) {
  // weight는 항상 g 단위로 저장. unit은 표시용.
  const unit = row?.unit === "kg" ? "kg" : "g";
  const rawWeight = Number(row?.weight) || 0;
  return {
    ingredientId: String(row?.ingredientId || ""),
    weight: rawWeight,  // g 기준
    unit                // 입력 시 단위 (표시 시 변환에 사용)
  };
}

export function createPreset({ productId, code = "", targetWeight = 0, label = "", unitIngredientId = "", inputAmount = 0, inputUnitLabel = "" } = {}) {
  return {
    id: makeId("preset"),
    productId: String(productId || ""),
    code: String(code || ""),
    targetWeight: Number(targetWeight) || 0,
    label: String(label || ""),
    unitIngredientId: String(unitIngredientId || ""),
    inputAmount: Number(inputAmount) || 0,
    inputUnitLabel: String(inputUnitLabel || "")
  };
}

// 제품 표시명 (종 접두어 합성)
export function getDisplayProductName(product) {
  if (!product) return "";
  const speciesLabel = product.species === "cat" ? "(고양이)" : product.species === "dog" ? "(강아지)" : "";
  return `${speciesLabel}${product.name}`.trim();
}
