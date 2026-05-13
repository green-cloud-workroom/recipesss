// selectors.js — state로부터 파생 데이터 계산
//
// 책임: UI에 바로 쓰기 좋은 형태로 state를 가공하는 순수 함수
// 의존: schema.js
//
// 원칙:
//   - 부수효과 없음. (state) => 계산 결과.
//   - DOM 안 만짐.
//   - 같은 입력엔 같은 출력.

import { getDisplayProductName } from "./schema.js";

// 제품 + composition을 UI에 쓰기 좋은 형태로
export function getProductView(state, productId) {
  const product = state.products[productId];
  if (!product) return null;

  const rows = product.composition.map((row, index) => {
    const ing = state.ingredients[row.ingredientId];
    return {
      index,
      ingredientId: row.ingredientId,
      name: ing?.name || "",
      kind: ing?.kind || "ingredient",
      displayName: ing?.displayName || "",
      weight: row.weight,
      unit: row.unit,
      isUnit: product.unitIngredientId === row.ingredientId,
      unitName: product.unitIngredientId === row.ingredientId ? product.unitLabel : ""
    };
  });

  return {
    id: product.id,
    name: product.name,
    species: product.species,
    displayName: getDisplayProductName(product),
    unitIngredientId: product.unitIngredientId,
    unitLabel: product.unitLabel,
    rows,
    ingredientRows: rows.filter(r => r.kind === "ingredient"),
    supplementRows: rows.filter(r => r.kind === "supplement")
  };
}

// 전체 제품 목록 (productOrder 순)
export function getProductList(state) {
  return state.productOrder
    .map(id => getProductView(state, id))
    .filter(Boolean);
}

// 단가 탭용: 사용되는 모든 ingredient (kind별로 그룹화)
export function getPriceTableView(state, { hideUnused = false } = {}) {
  // 모든 마스터 ingredient를 보여줌 (orphan 단가도 포함). 단가 입력 가능.
  const groups = { ingredient: [], supplement: [] };
  Object.values(state.ingredients).forEach(ing => {
    if (!ing.name) return; // 이름 없는 빈 행은 안 보여줌
    const price = state.prices[ing.id] || { unit: 0, price: 0 };
    const usageCount = countIngredientUsage(state, ing.id);
    if (hideUnused && usageCount === 0) return;
    groups[ing.kind].push({
      id: ing.id,
      name: ing.name,
      displayName: ing.displayName,
      unit: price.unit,
      price: price.price,
      usageCount
    });
  });
  // 사용 횟수 많은 것 우선, 그다음 이름순
  ["ingredient", "supplement"].forEach(k => {
    groups[k].sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.name.localeCompare(b.name);
    });
  });
  return groups;
}

function countIngredientUsage(state, ingredientId) {
  let count = 0;
  Object.values(state.products).forEach(p => {
    if (p.composition.some(r => r.ingredientId === ingredientId)) count++;
  });
  return count;
}

// 환산 비율 계산 (결과 탭용)
export function getRatioInfo(state, productId) {
  const product = state.products[productId];
  if (!product) return { ratio: 1, targetWeight: 0, unitRow: null, hasInput: false };

  const opt = state.ui.resultOptions[productId] || {};
  const unitIngId = opt.unitIngredientId || product.unitIngredientId;
  if (!unitIngId) return { ratio: 1, targetWeight: 0, unitRow: null, hasInput: false };

  const unitRow = product.composition.find(r => r.ingredientId === unitIngId);
  if (!unitRow || !unitRow.weight) return { ratio: 1, targetWeight: 0, unitRow: null, hasInput: false };
  const unitLabel = product.unitIngredientId === unitIngId ? String(product.unitLabel || "").trim() : "";

  const raw = parseFloat(opt.weight) || 0;
  if (raw <= 0) return { ratio: 1, targetWeight: 0, unitRow, unitLabel, inputUnitLabel: unitLabel || unitRow.unit || "g", hasInput: false };

  const targetWeight = unitLabel
    ? raw * unitRow.weight
    : unitRow.unit === "kg" ? raw * 1000 : raw;
  const ratio = targetWeight / unitRow.weight;
  return { ratio, targetWeight, unitRow, unitLabel, inputUnitLabel: unitLabel || unitRow.unit || "g", hasInput: true };
}

// 결과 카드용: 환산된 행 + 원가
export function getResultCardData(state, productId) {
  const product = state.products[productId];
  if (!product) return null;
  const view = getProductView(state, productId);
  const info = getRatioInfo(state, productId);
  const opt = state.ui.resultOptions[productId] || {};

  const sourceRows = opt.supplementOnly
    ? view.supplementRows
    : view.rows;

  let totalWeight = 0;
  let totalCost = 0;
  const rows = sourceRows
    .filter(r => r.name && r.weight > 0)
    .map(r => {
      const scaled = r.weight * info.ratio;
      const price = state.prices[r.ingredientId] || { unit: 0, price: 0 };
      const cost = price.unit > 0 ? (scaled / price.unit) * price.price : 0;
      totalWeight += scaled;
      totalCost += cost;
      return {
        ingredientId: r.ingredientId,
        name: r.name,
        displayName: r.displayName || r.name,
        kind: r.kind,
        scaledWeight: scaled,
        cost
      };
    });

  // 사용 가능한 생산단위 후보
  const unitOptions = view.ingredientRows
    .filter(r => r.weight > 0 && r.isUnit)
    .map(r => ({ ingredientId: r.ingredientId, name: r.name, weight: r.weight, unit: r.unit, unitName: r.unitName || "" }));
  // 만약 isUnit으로 지정된 게 없으면 빈 배열 → UI에서 "생산단위 지정 필요" 안내

  return {
    productView: view,
    info,
    rows,
    totalWeight,
    totalCost,
    unitOptions,
    opt
  };
}

// 발주 프리셋 보기: 제품별로 그룹화
export function getPresetsByProduct(state) {
  const grouped = {};
  Object.values(state.presets).forEach(preset => {
    if (!grouped[preset.productId]) grouped[preset.productId] = [];
    grouped[preset.productId].push(preset);
  });
  // weight 오름차순
  Object.values(grouped).forEach(list => list.sort((a, b) => a.targetWeight - b.targetWeight));
  return grouped;
}

export function getPresetDisplayName(state, preset) {
  const product = state.products[preset.productId];
  const productName = product ? getDisplayProductName(product) : "?";
  const weightLabel = preset.targetWeight >= 1000
    ? `${Math.round(preset.targetWeight / 1000).toString().padStart(2, "0")}KG`
    : `${Math.round(preset.targetWeight).toString().padStart(2, "0")}G`;
  return `${productName} ${weightLabel}${preset.label ? " " + preset.label : ""}`.trim();
}

// 프리셋별 비율 (orderQuantities 계산용)
export function getPresetRatio(state, preset) {
  const product = state.products[preset.productId];
  if (!product) return 1;
  const unitIngId = preset.unitIngredientId || product.unitIngredientId;
  const unitRow = product.composition.find(r => r.ingredientId === unitIngId);
  if (!unitRow || !unitRow.weight) return 1;
  return preset.targetWeight / unitRow.weight;
}

// 출력 미리보기용
export function getOrderPreviewRows(state) {
  return Object.entries(state.orderQuantities)
    .map(([key, qty]) => {
      const [presetId, ingredientId] = key.split("__");
      const preset = state.presets[presetId];
      const ing = state.ingredients[ingredientId];
      if (!preset || !ing || qty <= 0) return null;
      const product = state.products[preset.productId];
      return {
        code: preset.code,
        productName: product ? getDisplayProductName(product) : "?",
        presetName: getPresetDisplayName(state, preset),
        supplementName: ing.displayName || ing.name,
        rawSupplementName: ing.name,
        qty
      };
    })
    .filter(Boolean);
}

// 선택된 프리셋들의 영양제 양 (출력 탭용)
export function getSelectedPresetsView(state) {
  const selectedIds = state.ui.selectedPresetIds || [];
  return selectedIds
    .map(id => state.presets[id])
    .filter(Boolean)
    .map(preset => {
      const product = state.products[preset.productId];
      if (!product) return null;
      const ratio = getPresetRatio(state, preset);
      const supplements = product.composition
        .map(row => {
          const ing = state.ingredients[row.ingredientId];
          if (!ing || ing.kind !== "supplement" || !ing.name || !row.weight) return null;
          return {
            ingredientId: row.ingredientId,
            name: ing.name,
            displayName: ing.displayName || ing.name,
            scaledWeight: row.weight * ratio
          };
        })
        .filter(Boolean);
      return {
        preset,
        product,
        displayName: getPresetDisplayName(state, preset),
        ratio,
        supplements
      };
    })
    .filter(Boolean);
}

// 헬퍼: 이름으로 ingredient 찾기 (같은 kind 우선)
export function findIngredientByName(state, name, preferredKind = null) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const candidates = Object.values(state.ingredients).filter(ing => ing.name === trimmed);
  if (!candidates.length) return null;
  if (preferredKind) {
    const exact = candidates.find(c => c.kind === preferredKind);
    if (exact) return exact;
  }
  return candidates[0];
}
