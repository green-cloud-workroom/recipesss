// migrations.js — v1 데이터를 v2 스키마로 변환
//
// 책임: v1 데이터를 손실 없이 v2로 옮기기
// 의존: schema.js
//
// v1 구조 요약:
//   recipe_cost_utf8_v1: { products[], prices{name}, selectedProducts[], resultOptions{pid} }
//   recipe_cost_order_v1: { orderPresets{productName}[], orderInputs{"name__code__sup"} }
//
// 핵심 매핑:
//   - product의 row.id → ingredient.id 매핑 테이블이 결정적으로 중요
//     (resultOptions.unitId가 row.id를 가리키고 있어서)

import { createEmptyState, createIngredient, createProduct, createPreset } from "./schema.js?v=20260513-unused-sup-cleanup-1";

// 종 접두어 추출. 화이트리스트.
const SPECIES_PREFIX_RE = /^\((고양이|강아지)\)\s*/;

function extractSpecies(name) {
  const clean = String(name || "").trim();
  const match = clean.match(SPECIES_PREFIX_RE);
  if (!match) return { species: null, baseName: clean };
  const species = match[1] === "고양이" ? "cat" : "dog";
  const baseName = clean.replace(SPECIES_PREFIX_RE, "").trim();
  return { species, baseName };
}

// kind별 ingredient 마스터 lookup. 없으면 새로 생성.
class IngredientRegistry {
  constructor() {
    this.byKey = new Map();  // "name|kind" → ingredient
    this.byRowId = new Map(); // v1 row.id → ingredient.id (resultOptions 매핑용)
    this.master = {};         // id → ingredient (최종 결과)
  }
  resolve(rawName, kind, rowId, alias = "") {
    const name = String(rawName || "").trim();
    if (!name) return null;
    const key = `${name}|${kind}`;
    let ing = this.byKey.get(key);
    if (!ing) {
      ing = createIngredient({
        name,
        kind,
        displayName: kind === "supplement" ? alias : ""
      });
      this.byKey.set(key, ing);
      this.master[ing.id] = ing;
    } else if (kind === "supplement" && alias && !ing.displayName) {
      // 첫 alias만 채택
      ing.displayName = alias;
    }
    if (rowId) this.byRowId.set(rowId, ing.id);
    return ing;
  }
}

export function migrateV1toV2(v1Data) {
  const next = createEmptyState();
  if (!v1Data || !v1Data.recipe) return next;

  const reg = new IngredientRegistry();
  const productNameToId = new Map();  // v1 product.name (with prefix) → v2 product.id
  const productIdMap = new Map();     // v1 product.id → v2 product.id

  // 1단계: 제품 + 원료 마이그레이션
  const v1Products = Array.isArray(v1Data.recipe.products) ? v1Data.recipe.products : [];
  v1Products.forEach(v1p => {
    const { species, baseName } = extractSpecies(v1p.name);

    const composition = [];
    let unitIngredientId = "";
    let unitLabel = "";

    // 원료 처리
    (v1p.ingredients || []).forEach(row => {
      const ing = reg.resolve(row.name, "ingredient", row.id);
      if (!ing) return;
      // weight 정규화: v1은 unit이 "kg"이면 weight 필드가 이미 *1000된 형태인지,
      // 아니면 raw 입력값인지 코드 확인 필요. index.html의 collectAllInputs를 보면
      // row.weight = raw * 1000 (unit이 kg일 때). 즉 항상 g 단위로 저장됨.
      composition.push({
        ingredientId: ing.id,
        weight: Number(row.weight) || 0,
        unit: row.unit === "kg" ? "kg" : "g"
      });
      if (row.isUnit && !unitIngredientId) {
        unitIngredientId = ing.id;
        unitLabel = String(row.unitName || "");
      }
    });

    // 영양제 처리
    (v1p.supplements || []).forEach(row => {
      const ing = reg.resolve(row.name, "supplement", row.id, row.alias);
      if (!ing) return;
      composition.push({
        ingredientId: ing.id,
        weight: Number(row.weight) || 0,
        unit: row.unit === "kg" ? "kg" : "g"
      });
    });

    const product = createProduct({
      name: baseName,
      species,
      unitIngredientId,
      unitLabel,
      composition
    });
    next.products[product.id] = product;
    next.productOrder.push(product.id);
    productNameToId.set(v1p.name, product.id);
    productIdMap.set(v1p.id, product.id);
  });

  next.ingredients = reg.master;

  // 2단계: 단가 마이그레이션 (이름 기반 → id 기반)
  // 레시피에 없는 단가(예: 미리 입력해둔 항목)도 orphan ingredient로 보존
  const v1Prices = v1Data.recipe.prices || {};
  Object.entries(v1Prices).forEach(([name, priceRow]) => {
    const cleanName = String(name).trim();
    if (!cleanName) return;

    // 이미 레시피로부터 등록된 ingredient (ingredient/supplement 양쪽 확인)
    let matched = false;
    ["ingredient", "supplement"].forEach(kind => {
      const ing = reg.byKey.get(`${cleanName}|${kind}`);
      if (!ing) return;
      matched = true;
      next.prices[ing.id] = {
        unit: Number(priceRow.unit) || 0,
        price: Number(priceRow.price) || 0
      };
    });

    // 어디에도 매칭 안 됨 → 단가 전용 orphan으로 보존.
    // 영양제 성격이 뚜렷한 이름은 supplement로 분류해 단가 탭 위치를 맞춘다.
    if (!matched) {
      const ing = reg.resolve(cleanName, inferOrphanPriceKind(cleanName), null);
      if (ing) {
        next.prices[ing.id] = {
          unit: Number(priceRow.unit) || 0,
          price: Number(priceRow.price) || 0
        };
      }
    }
  });

  // 3단계: UI 상태 — selectedProducts, resultOptions
  const v1Selected = v1Data.recipe.selectedProducts || [];
  next.ui.selectedProductIds = v1Selected
    .map(oldPid => productIdMap.get(oldPid))
    .filter(Boolean);

  const v1ResultOpts = v1Data.recipe.resultOptions || {};
  Object.entries(v1ResultOpts).forEach(([oldPid, opt]) => {
    const newPid = productIdMap.get(oldPid);
    if (!newPid) return;
    // unitId(v1 row.id)를 v2 ingredient.id로 매핑
    const unitIngredientId = opt.unitId ? (reg.byRowId.get(opt.unitId) || "") : "";
    next.ui.resultOptions[newPid] = {
      unitIngredientId,
      weight: String(opt.weight || ""),
      supplementOnly: Boolean(opt.supplementOnly),
      presetLabel: String(opt.presetLabel || "")
    };
  });

  // 4단계: 발주 프리셋 + orderInputs
  const v1Order = v1Data.order || {};
  const v1Presets = v1Order.orderPresets || v1Order.presets || v1Data.recipe.orderPresets || {};
  const presetCodeMap = new Map(); // "productName|code" → v2 preset.id (orderInputs 매핑용)

  Object.entries(v1Presets).forEach(([productName, presetList]) => {
    const productId = productNameToId.get(productName);
    if (!productId) return;
    const product = next.products[productId];
    if (!Array.isArray(presetList)) return;

    presetList.forEach((p, i) => {
      const weight = Number(p?.weight) || 0;
      if (!weight) return;
      // v1의 preset.unitId가 row.id 기반 → ingredientId로 매핑
      const unitIngId = p.unitId ? (reg.byRowId.get(p.unitId) || product.unitIngredientId) : product.unitIngredientId;
      const preset = createPreset({
        productId,
        code: p.code || autoCode(product.name, i),
        targetWeight: weight,
        label: String(p.label || ""),
        unitIngredientId: unitIngId
      });
      next.presets[preset.id] = preset;
      presetCodeMap.set(`${productName}|${preset.code}`, preset.id);
    });
  });

  // orderInputs: "productName__code__supplementName" → "presetId__ingredientId"
  const v1OrderInputs = v1Order.orderInputs || v1Order.orderData || v1Data.recipe.orderInputs || {};
  Object.entries(v1OrderInputs).forEach(([key, qty]) => {
    const parts = key.split("__");
    if (parts.length < 3) return;
    const [productName, code, ...rest] = parts;
    const supplementName = rest.join("__"); // 영양제 이름에 __가 있을 가능성은 거의 없지만 보호
    const presetId = presetCodeMap.get(`${productName}|${code}`);
    const ing = reg.byKey.get(`${supplementName}|supplement`);
    if (!presetId || !ing) return;
    const amount = parseInt(qty, 10) || 0;
    if (amount > 0) {
      next.orderQuantities[`${presetId}__${ing.id}`] = amount;
    }
  });

  return next;
}

export function normalizeV2State(state) {
  if (!state || !state.ingredients || !state.products) {
    return { state, changed: false };
  }

  let changed = false;
  const ingredients = { ...state.ingredients };
  const prices = { ...state.prices };

  Object.values(state.ingredients).forEach(ing => {
    if (!ing || ing.kind !== "ingredient") return;
    if (countIngredientUsage(state, ing.id) > 0) return;
    if (!prices[ing.id]) return;
    if (inferOrphanPriceKind(ing.name) !== "supplement") return;

    const duplicate = Object.values(ingredients).find(other =>
      other.id !== ing.id &&
      other.kind === "supplement" &&
      other.name === ing.name
    );

    if (duplicate) {
      if (!prices[duplicate.id]) prices[duplicate.id] = prices[ing.id];
      delete prices[ing.id];
      delete ingredients[ing.id];
    } else {
      ingredients[ing.id] = { ...ing, kind: "supplement" };
    }
    changed = true;
  });

  if (!changed) return { state, changed: false };
  return {
    state: {
      ...state,
      ingredients,
      prices
    },
    changed: true
  };
}

function countIngredientUsage(state, ingredientId) {
  let count = 0;
  Object.values(state.products || {}).forEach(product => {
    if ((product.composition || []).some(row => row.ingredientId === ingredientId)) count += 1;
  });
  return count;
}

function inferOrphanPriceKind(name) {
  const clean = String(name || "").trim();
  if (!clean) return "ingredient";
  if (/^(Sa|Mii|Cha|H)$/i.test(clean)) return "supplement";
  if (/(비타민|아연|철|구리|망간|마그네슘|칼슘|킬레이트|토코페롤|켈프|요오드|난각|멸치가루|차전차피|미역가루|홍삼|소금|파우더|D3)/i.test(clean)) {
    return "supplement";
  }
  return "ingredient";
}

function autoCode(productName, index) {
  // 단순 fallback. 알파벳 + 숫자.
  const ch = productName.charCodeAt(0);
  const prefix = ch ? String.fromCharCode(65 + (ch % 26)) : "P";
  return `${prefix}${index}`;
}

