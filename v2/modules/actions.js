// actions.js — 모든 액션의 reducer
//
// 책임: state를 받아서 새 state를 만드는 순수 함수들
// 의존: schema.js, repository.js (RESTORE_SNAPSHOT용)
//
// 규칙:
//   - reducer는 (state, action) => newState
//   - state를 직접 변경하지 않고 새 객체/배열을 만듦 (얕은 복사로 충분)
//   - action은 { type, ...payload } 형태
//   - reducer 이름 = action.type (대문자 스네이크)

import { createProduct, createIngredient, createPreset } from "./schema.js?v=20260513-preset-group-select-1";
import { loadSnapshot } from "./repository.js?v=20260513-preset-group-select-1";

// 헬퍼: composition에서 ingredient 사용 여부
function isIngredientUsedAnywhere(state, ingredientId, excludeProductId = null) {
  return Object.values(state.products).some(p => {
    if (p.id === excludeProductId) return false;
    return p.composition.some(row => row.ingredientId === ingredientId);
  });
}

export const reducers = {
  // ===== 제품 =====
  ADD_PRODUCT: (state, _action) => {
    const product = createProduct({});
    return {
      ...state,
      products: { ...state.products, [product.id]: product },
      productOrder: [...state.productOrder, product.id],
      ui: { ...state.ui, editingProductId: product.id }
    };
  },

  // 기존 제품을 복사. composition은 같은 ingredient를 참조 (마스터 데이터 공유 유지).
  // 새 제품은 원본 바로 뒤에 삽입.
  DUPLICATE_PRODUCT: (state, { productId }) => {
    const source = state.products[productId];
    if (!source) return state;
    const cloned = createProduct({
      name: source.name ? `${source.name} (복사)` : "",
      species: source.species,
      unitIngredientId: source.unitIngredientId,
      unitLabel: source.unitLabel,
      composition: source.composition.map(row => ({ ...row }))
    });
    const idx = state.productOrder.indexOf(productId);
    const newOrder = state.productOrder.slice();
    if (idx >= 0) newOrder.splice(idx + 1, 0, cloned.id);
    else newOrder.push(cloned.id);
    return {
      ...state,
      products: { ...state.products, [cloned.id]: cloned },
      productOrder: newOrder
    };
  },

  UPDATE_PRODUCT: (state, { productId, patch }) => {
    const current = state.products[productId];
    if (!current) return state;
    return {
      ...state,
      products: {
        ...state.products,
        [productId]: { ...current, ...patch }
      }
    };
  },

  REMOVE_PRODUCT: (state, { productId }) => {
    if (!state.products[productId]) return state;
    const { [productId]: removed, ...restProducts } = state.products;
    const newOrder = state.productOrder.filter(id => id !== productId);
    const newSelected = state.ui.selectedProductIds.filter(id => id !== productId);
    const { [productId]: _, ...restResultOpts } = state.ui.resultOptions;

    // 이 제품에만 묶였던 ingredient는 그대로 둠 (단가 보존 가치).
    // 명시적으로 정리하려면 별도 액션.

    // 이 제품의 프리셋 제거 + 관련 orderQuantities 제거
    const newPresets = {};
    const removedPresetIds = new Set();
    Object.entries(state.presets).forEach(([pid, preset]) => {
      if (preset.productId === productId) removedPresetIds.add(pid);
      else newPresets[pid] = preset;
    });
    const newOrderQty = {};
    Object.entries(state.orderQuantities).forEach(([key, qty]) => {
      const [presetId] = key.split("__");
      if (!removedPresetIds.has(presetId)) newOrderQty[key] = qty;
    });

    return {
      ...state,
      products: restProducts,
      productOrder: newOrder,
      presets: newPresets,
      orderQuantities: newOrderQty,
      ui: {
        ...state.ui,
        selectedProductIds: newSelected,
        selectedPresetIds: (state.ui.selectedPresetIds || []).filter(id => !removedPresetIds.has(id)),
        resultOptions: restResultOpts,
        editingProductId: state.ui.editingProductId === productId ? null : state.ui.editingProductId
      }
    };
  },

  SET_EDITING_PRODUCT: (state, { productId }) => ({
    ...state,
    ui: { ...state.ui, editingProductId: productId || null }
  }),

  // ===== 제품 composition (원료/영양제 행) =====
  // 행 추가: ingredient를 새로 만들거나 기존 ingredient를 재사용
  ADD_COMPOSITION_ROW: (state, { productId, kind = "ingredient", ingredientId = null }) => {
    const product = state.products[productId];
    if (!product) return state;

    let ingredients = state.ingredients;
    let resolvedIngId = ingredientId;

    if (!resolvedIngId) {
      // 빈 이름의 새 ingredient를 만듦. 사용자가 이름 입력하면 머지 처리는 별도 액션에서.
      const ing = createIngredient({ name: "", kind });
      ingredients = { ...ingredients, [ing.id]: ing };
      resolvedIngId = ing.id;
    }

    return {
      ...state,
      ingredients,
      products: {
        ...state.products,
        [productId]: {
          ...product,
          composition: [
            ...product.composition,
            { ingredientId: resolvedIngId, weight: 0, unit: "g" }
          ]
        }
      }
    };
  },

  REMOVE_COMPOSITION_ROW: (state, { productId, index }) => {
    const product = state.products[productId];
    if (!product || index < 0 || index >= product.composition.length) return state;
    const removed = product.composition[index];
    const newComposition = product.composition.filter((_, i) => i !== index);

    let nextState = {
      ...state,
      products: {
        ...state.products,
        [productId]: {
          ...product,
          composition: newComposition,
          // 생산단위 원료가 제거되면 unitIngredientId 클리어
          unitIngredientId: product.unitIngredientId === removed.ingredientId
            ? ""
            : product.unitIngredientId
        }
      }
    };

    // 다른 곳에서도 안 쓰는 ingredient면 마스터에서 제거 (단가는 보존 가치 있어서 유지)
    // → 일단 보존. orphan ingredient는 단가 탭에서 정리 가능하게 추후 액션 추가.

    return nextState;
  },

  UPDATE_COMPOSITION_ROW: (state, { productId, index, patch }) => {
    const product = state.products[productId];
    if (!product || index < 0 || index >= product.composition.length) return state;
    const row = product.composition[index];
    const newRow = { ...row, ...patch };
    const newComposition = [...product.composition];
    newComposition[index] = newRow;
    return {
      ...state,
      products: {
        ...state.products,
        [productId]: { ...product, composition: newComposition }
      }
    };
  },

  // ingredient 이름을 바꾸거나, 새 이름으로 입력 시 기존 ingredient에 머지하는 액션.
  // patch: { name, kind, displayName } 중 일부
  UPDATE_INGREDIENT: (state, { ingredientId, patch }) => {
    const ing = state.ingredients[ingredientId];
    if (!ing) return state;
    return {
      ...state,
      ingredients: {
        ...state.ingredients,
        [ingredientId]: { ...ing, ...patch }
      }
    };
  },

  // 행 단위로 ingredient 교체 (행에서 이름을 다른 기존 ingredient의 이름과 같게 입력했을 때 머지)
  REPLACE_COMPOSITION_INGREDIENT: (state, { productId, index, newIngredientId }) => {
    const product = state.products[productId];
    if (!product || index < 0 || index >= product.composition.length) return state;
    const row = product.composition[index];
    if (row.ingredientId === newIngredientId) return state;

    const newComposition = [...product.composition];
    newComposition[index] = { ...row, ingredientId: newIngredientId };

    // 생산단위가 옛 ingredient를 가리키고 있었다면 갱신
    const newUnitIngId = product.unitIngredientId === row.ingredientId
      ? newIngredientId
      : product.unitIngredientId;

    return {
      ...state,
      products: {
        ...state.products,
        [productId]: { ...product, composition: newComposition, unitIngredientId: newUnitIngId }
      }
    };
  },

  // ===== 단가 =====
  UPDATE_PRICE: (state, { ingredientId, unit, price }) => ({
    ...state,
    prices: {
      ...state.prices,
      [ingredientId]: {
        unit: Number(unit) || 0,
        price: Number(price) || 0
      }
    }
  }),

  REMOVE_UNUSED_SUPPLEMENT: (state, { ingredientId }) => {
    const ing = state.ingredients[ingredientId];
    if (!ing || ing.kind !== "supplement") return state;
    if (isIngredientUsedAnywhere(state, ingredientId)) return state;

    const { [ingredientId]: _removedIng, ...ingredients } = state.ingredients;
    const { [ingredientId]: _removedPrice, ...prices } = state.prices;
    return { ...state, ingredients, prices };
  },

  REMOVE_ALL_UNUSED_SUPPLEMENTS: (state) => {
    const unusedIds = Object.values(state.ingredients)
      .filter(ing => ing.kind === "supplement" && !isIngredientUsedAnywhere(state, ing.id))
      .map(ing => ing.id);
    if (!unusedIds.length) return state;

    const unusedSet = new Set(unusedIds);
    const ingredients = {};
    Object.entries(state.ingredients).forEach(([id, ing]) => {
      if (!unusedSet.has(id)) ingredients[id] = ing;
    });
    const prices = {};
    Object.entries(state.prices).forEach(([id, price]) => {
      if (!unusedSet.has(id)) prices[id] = price;
    });
    return { ...state, ingredients, prices };
  },

  // ===== 결과/선택 =====
  TOGGLE_SELECTED_PRODUCT: (state, { productId }) => {
    const idx = state.ui.selectedProductIds.indexOf(productId);
    const next = idx > -1
      ? state.ui.selectedProductIds.filter(id => id !== productId)
      : [...state.ui.selectedProductIds, productId];
    return { ...state, ui: { ...state.ui, selectedProductIds: next } };
  },

  SET_SELECTED_PRODUCTS: (state, { productIds }) => ({
    ...state,
    ui: { ...state.ui, selectedProductIds: Array.isArray(productIds) ? productIds.slice() : [] }
  }),

  UPDATE_RESULT_OPTION: (state, { productId, patch }) => {
    const current = state.ui.resultOptions[productId] || {
      unitIngredientId: "",
      weight: "",
      supplementOnly: false,
      presetLabel: ""
    };
    return {
      ...state,
      ui: {
        ...state.ui,
        resultOptions: {
          ...state.ui.resultOptions,
          [productId]: { ...current, ...patch }
        }
      }
    };
  },

  // ===== 발주 프리셋 =====
  ADD_PRESET: (state, { productId, targetWeight, label, unitIngredientId, code, inputAmount, inputUnitLabel }) => {
    const product = state.products[productId];
    if (!product) return state;
    const preset = createPreset({
      productId,
      targetWeight,
      label,
      unitIngredientId: unitIngredientId || product.unitIngredientId,
      code: code || "",
      inputAmount,
      inputUnitLabel
    });
    // code 자동 생성: 같은 제품 프리셋 수 기반
    if (!preset.code) {
      const existing = Object.values(state.presets).filter(p => p.productId === productId).length;
      const productIdx = state.productOrder.indexOf(productId);
      const prefix = productIdx >= 0 && productIdx < 26 ? String.fromCharCode(65 + productIdx) : "P";
      preset.code = `${prefix}${existing}`;
    }
    return { ...state, presets: { ...state.presets, [preset.id]: preset } };
  },

  REMOVE_PRESET: (state, { presetId }) => {
    if (!state.presets[presetId]) return state;
    const { [presetId]: _, ...rest } = state.presets;
    const newOrderQty = {};
    Object.entries(state.orderQuantities).forEach(([key, qty]) => {
      const [pid] = key.split("__");
      if (pid !== presetId) newOrderQty[key] = qty;
    });
    return {
      ...state,
      presets: rest,
      orderQuantities: newOrderQty,
      ui: {
        ...state.ui,
        selectedPresetIds: (state.ui.selectedPresetIds || []).filter(id => id !== presetId)
      }
    };
  },

  CLEAR_ALL_PRESETS: (state) => ({
    ...state,
    presets: {},
    orderQuantities: {},
    ui: { ...state.ui, selectedPresetIds: [] }
  }),

  // ===== 발주 프리셋 선택 =====
  TOGGLE_SELECTED_PRESET: (state, { presetId }) => {
    const list = state.ui.selectedPresetIds || [];
    const idx = list.indexOf(presetId);
    const next = idx > -1 ? list.filter(id => id !== presetId) : [...list, presetId];
    return { ...state, ui: { ...state.ui, selectedPresetIds: next } };
  },

  SET_SELECTED_PRESETS: (state, { presetIds }) => ({
    ...state,
    ui: { ...state.ui, selectedPresetIds: Array.isArray(presetIds) ? presetIds.slice() : [] }
  }),

  // ===== 발주 수량 =====
  SET_ORDER_QUANTITY: (state, { presetId, ingredientId, amount }) => {
    const key = `${presetId}__${ingredientId}`;
    const n = parseInt(amount, 10) || 0;
    const next = { ...state.orderQuantities };
    if (n > 0) next[key] = n;
    else delete next[key];
    return { ...state, orderQuantities: next };
  },

  // ===== UI =====
  SET_ACTIVE_TAB: (state, { tab }) => ({
    ...state,
    ui: { ...state.ui, activeTab: tab }
  }),

  // ===== 스냅샷 되돌리기 =====
  RESTORE_SNAPSHOT: (state, { snapshotId }) => {
    const snap = loadSnapshot(snapshotId);
    return snap || state;
  },

  // ===== 엑셀 import =====
  IMPORT_PRODUCTS: (state, { products = [] }) => {
    if (!Array.isArray(products) || !products.length) return state;

    const ingredients = { ...state.ingredients };
    const ingredientByKey = new Map(
      Object.values(ingredients).map(ing => [`${ing.name.trim()}|${ing.kind}`, ing.id])
    );
    const productByKey = new Map(
      Object.values(state.products).map(product => [`${product.species || ""}|${product.name.trim()}`, product.id])
    );

    const nextProducts = { ...state.products };
    const nextOrder = [...state.productOrder];
    const nextResultOptions = { ...state.ui.resultOptions };
    const nextPresets = { ...state.presets };

    products.forEach(imported => {
      const productName = String(imported.name || "").trim();
      if (!productName) return;
      const species = imported.species === "cat" || imported.species === "dog" ? imported.species : null;
      const key = `${species || ""}|${productName}`;

      const composition = [];
      let unitIngredientId = "";
      let unitLabel = String(imported.unitLabel || "");

      (imported.composition || []).forEach(row => {
        const ingredientName = String(row.ingredientName || row.name || "").trim();
        if (!ingredientName) return;
        const kind = row.kind === "supplement" ? "supplement" : "ingredient";
        const ingredientKey = `${ingredientName}|${kind}`;
        let ingredientId = ingredientByKey.get(ingredientKey);
        if (!ingredientId) {
          const ing = createIngredient({ name: ingredientName, kind });
          ingredientId = ing.id;
          ingredients[ingredientId] = ing;
          ingredientByKey.set(ingredientKey, ingredientId);
        }
        composition.push({
          ingredientId,
          weight: Number(row.weight) || 0,
          unit: row.unit === "kg" ? "kg" : "g"
        });
        if (row.isUnit && !unitIngredientId) {
          unitIngredientId = ingredientId;
          unitLabel = String(row.unitLabel || unitLabel || "");
        }
      });

      if (!composition.length) return;

      const existingId = productByKey.get(key);
      const product = createProduct({
        name: productName,
        species,
        unitIngredientId,
        unitLabel,
        composition
      });

      if (existingId) {
        product.id = existingId;
        nextProducts[existingId] = product;
        const validIds = new Set(composition.map(row => row.ingredientId));
        const option = nextResultOptions[existingId];
        if (option && option.unitIngredientId && !validIds.has(option.unitIngredientId)) {
          nextResultOptions[existingId] = { ...option, unitIngredientId: unitIngredientId || "" };
        }
        Object.entries(nextPresets).forEach(([presetId, preset]) => {
          if (preset.productId === existingId && preset.unitIngredientId && !validIds.has(preset.unitIngredientId)) {
            nextPresets[presetId] = { ...preset, unitIngredientId: unitIngredientId || "" };
          }
        });
      } else {
        nextProducts[product.id] = product;
        nextOrder.push(product.id);
        productByKey.set(key, product.id);
      }
    });

    return {
      ...state,
      ingredients,
      products: nextProducts,
      productOrder: nextOrder,
      presets: nextPresets,
      ui: {
        ...state.ui,
        resultOptions: nextResultOptions,
        editingProductId: null
      }
    };
  }
};

