// ui-tab-recipe.js - recipe list, category rail, and inline editing.

import { getProductList, findIngredientByName } from "./selectors.js?v=20260513-recipe-categories-1";
import { esc, parseWeightInput, displayWeight } from "./utils.js?v=20260513-recipe-categories-1";
import { toast } from "./ui-shell.js?v=20260513-recipe-categories-1";

export function initRecipeTab(store) {
  const listEl = document.getElementById("productList");
  const countEl = document.getElementById("productCount");
  const filteredCountEl = document.getElementById("filteredProductCount");
  const categoryListEl = document.getElementById("recipeCategoryList");
  const categoryTitleEl = document.getElementById("recipeCategoryTitle");
  const addBtn = document.getElementById("addProductBtn");
  let activeCategory = "all";

  function flush() {
    if (document.activeElement && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) {
      document.activeElement.blur();
    }
  }

  addBtn.addEventListener("click", () => {
    flush();
    activeCategory = "all";
    store.dispatch({ type: "ADD_PRODUCT" });
  });

  categoryListEl?.addEventListener("click", e => {
    const target = e.target.closest("[data-category]");
    if (!target) return;
    activeCategory = target.dataset.category || "all";
    render();
  });

  listEl.addEventListener("click", e => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    flush();
    handleClickAction(store, target);
  });

  listEl.addEventListener("change", e => {
    const target = e.target.closest("[data-change]");
    if (!target) return;
    handleChangeAction(store, target);
  });

  listEl.addEventListener("blur", e => {
    const target = e.target.closest("[data-blur]");
    if (!target) return;
    handleBlurAction(store, target);
  }, true);

  [
    "ADD_PRODUCT", "REMOVE_PRODUCT", "UPDATE_PRODUCT", "SET_EDITING_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT"
  ].forEach(type => store.subscribe(type, render));

  function render() {
    const state = store.getState();
    const products = getProductList(state);
    const categories = buildCategories(products);
    if (!categories.some(category => category.id === activeCategory && category.count > 0)) {
      activeCategory = "all";
    }

    const active = categories.find(category => category.id === activeCategory) || categories[0];
    const visibleProducts = products.filter(product => matchesCategory(product, activeCategory));
    countEl.textContent = products.length;
    if (filteredCountEl) filteredCountEl.textContent = visibleProducts.length;
    if (categoryTitleEl) categoryTitleEl.textContent = active?.title || "전체 레시피";
    if (categoryListEl) categoryListEl.innerHTML = categories.map(category => renderCategory(category, activeCategory)).join("");

    if (!products.length) {
      listEl.className = "";
      listEl.innerHTML = '<div class="empty">제품을 추가해 주세요.</div>';
      return;
    }

    if (!visibleProducts.length) {
      listEl.className = "";
      listEl.innerHTML = '<div class="empty">이 카테고리에 표시할 레시피가 없습니다.</div>';
      return;
    }

    listEl.className = "product-list";
    listEl.innerHTML = visibleProducts.map(p => renderCard(p, state.ui.editingProductId === p.id)).join("");
  }

  render();
}

function buildCategories(products) {
  const categories = [
    { id: "all", title: "전체 레시피", label: "전체", count: products.length },
    { id: "cat", title: "고양이 레시피", label: "고양이", count: products.filter(product => product.species === "cat").length },
    { id: "dog", title: "강아지 레시피", label: "강아지", count: products.filter(product => product.species === "dog").length },
    { id: "common", title: "공용/기타 레시피", label: "공용/기타", count: products.filter(product => !product.species).length },
    { id: "frozen", title: "동결 레시피", label: "동결", count: products.filter(product => /동결/.test(product.name || product.displayName || "")).length }
  ];
  return categories.filter(category => category.id === "all" || category.count > 0);
}

function matchesCategory(product, category) {
  if (category === "all") return true;
  if (category === "cat") return product.species === "cat";
  if (category === "dog") return product.species === "dog";
  if (category === "common") return !product.species;
  if (category === "frozen") return /동결/.test(product.name || product.displayName || "");
  return true;
}

function renderCategory(category, activeCategory) {
  return `
    <button class="recipe-category ${category.id === activeCategory ? "active" : ""}" data-category="${category.id}">
      <span class="recipe-category-name">${esc(category.label)}</span>
      <span class="recipe-category-count">${category.count}</span>
    </button>`;
}

function renderCard(product, isEditing) {
  const title = product.displayName || "이름 없는 제품";
  const meta = `원료 ${product.ingredientRows.length}개 · 영양제 ${product.supplementRows.length}개`;

  return `
    <div class="card ${isEditing ? "editing" : "collapsed"}" data-pid="${product.id}">
      <div class="card-header">
        ${isEditing
          ? renderHeaderEdit(product)
          : `<div class="product-summary"><div class="product-title">${esc(title)}</div><div class="product-meta">${esc(meta)}</div></div>`}
        <div class="product-actions">
          <button class="btn" data-action="toggle-edit" data-pid="${product.id}">${isEditing ? "닫기" : "수정"}</button>
          <button class="btn btn-danger" data-action="remove-product" data-pid="${product.id}">삭제</button>
        </div>
      </div>
      ${isEditing ? renderCardBody(product) : ""}
    </div>`;
}

function renderHeaderEdit(product) {
  return `
    <div class="card-header-edit">
      <select data-change="species" data-pid="${product.id}" class="species-select">
        <option value="" ${!product.species ? "selected" : ""}>(종 없음)</option>
        <option value="cat" ${product.species === "cat" ? "selected" : ""}>고양이</option>
        <option value="dog" ${product.species === "dog" ? "selected" : ""}>강아지</option>
      </select>
      <input type="text" class="product-name-input"
        data-blur="product-name" data-pid="${product.id}"
        value="${esc(product.name)}" placeholder="제품명(접두어 빼고)">
    </div>`;
}

function renderCardBody(product) {
  return `
    <div class="slabel" style="margin-top:0">원료</div>
    ${renderRowTable(product, "ingredient")}
    <button class="btn btn-sm" data-action="add-row" data-pid="${product.id}" data-kind="ingredient">+ 원료 추가</button>

    <div class="slabel">영양제</div>
    ${renderRowTable(product, "supplement")}
    <button class="btn btn-sm" data-action="add-row" data-pid="${product.id}" data-kind="supplement">+ 영양제 추가</button>
  `;
}

function renderRowTable(product, kind) {
  const rows = kind === "ingredient" ? product.ingredientRows : product.supplementRows;
  const isIng = kind === "ingredient";

  if (!rows.length) return '<div class="empty-row">행이 없습니다.</div>';

  return `
    <table>
      <thead>
        <tr>
          <th>${isIng ? "원료명" : "영양제명"}</th>
          ${!isIng ? '<th style="width:120px">표시명</th>' : ""}
          <th style="text-align:right;width:160px">중량</th>
          ${isIng ? '<th style="text-align:center;width:70px">생산단위</th>' : ""}
          ${isIng ? '<th style="width:120px">단위명</th>' : ""}
          <th style="width:32px"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => renderRow(product.id, row, kind)).join("")}
      </tbody>
    </table>`;
}

function renderRow(productId, row, kind) {
  const wt = displayWeight(row.weight, row.unit);
  const wtAttr = wt === "" ? "" : `value="${wt}"`;
  const cellName = `
    <td><input type="text" class="row-name-input"
        data-blur="row-name" data-pid="${productId}" data-idx="${row.index}"
        value="${esc(row.name)}" placeholder="${kind === "ingredient" ? "원료명" : "영양제명"}"></td>`;
  const cellDisplayName = kind === "supplement" ? `
    <td><input type="text"
        data-blur="row-display-name" data-pid="${productId}" data-idx="${row.index}"
        value="${esc(row.displayName)}" placeholder="치환명(선택)"></td>` : "";
  const cellWeight = `
    <td>
      <div class="inline-weight">
        <input type="number" class="row-weight-input"
          data-blur="row-weight" data-pid="${productId}" data-idx="${row.index}"
          ${wtAttr} placeholder="0" min="0" step="any">
        <select data-change="row-unit" data-pid="${productId}" data-idx="${row.index}">
          <option value="g" ${row.unit === "g" ? "selected" : ""}>g</option>
          <option value="kg" ${row.unit === "kg" ? "selected" : ""}>kg</option>
        </select>
      </div>
    </td>`;
  const cellIsUnit = kind === "ingredient" ? `
    <td style="text-align:center">
      <input type="checkbox" data-change="row-is-unit" data-pid="${productId}" data-idx="${row.index}"
        ${row.isUnit ? "checked" : ""}>
    </td>` : "";
  const cellUnitName = kind === "ingredient" ? `
    <td><input type="text"
        data-blur="row-unit-name" data-pid="${productId}" data-idx="${row.index}"
        value="${esc(row.isUnit ? (row.unitName || "") : "")}"
        placeholder="${row.isUnit ? "마리/개 등" : ""}" ${row.isUnit ? "" : "disabled"}></td>` : "";
  const cellRemove = `
    <td><button class="btn-icon" data-action="remove-row" data-pid="${productId}" data-idx="${row.index}" title="삭제">×</button></td>`;

  return `<tr>
    ${cellName}
    ${cellDisplayName}
    ${cellWeight}
    ${cellIsUnit}
    ${cellUnitName}
    ${cellRemove}
  </tr>`;
}

function handleClickAction(store, target) {
  const action = target.dataset.action;
  const pid = target.dataset.pid;
  const idx = target.dataset.idx ? parseInt(target.dataset.idx, 10) : null;
  const kind = target.dataset.kind || "ingredient";

  switch (action) {
    case "toggle-edit": {
      const current = store.getState().ui.editingProductId;
      store.dispatch({ type: "SET_EDITING_PRODUCT", productId: current === pid ? null : pid });
      break;
    }
    case "remove-product": {
      if (confirm("이 제품을 삭제할까요?")) {
        store.dispatch({ type: "REMOVE_PRODUCT", productId: pid });
        toast("제품 삭제됨");
      }
      break;
    }
    case "add-row":
      store.dispatch({ type: "ADD_COMPOSITION_ROW", productId: pid, kind });
      break;
    case "remove-row":
      store.dispatch({ type: "REMOVE_COMPOSITION_ROW", productId: pid, index: idx });
      break;
  }
}

function handleChangeAction(store, target) {
  const action = target.dataset.change;
  const pid = target.dataset.pid;
  const idx = target.dataset.idx ? parseInt(target.dataset.idx, 10) : null;

  switch (action) {
    case "species":
      store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { species: target.value || null } });
      break;
    case "row-unit":
      store.dispatch({ type: "UPDATE_COMPOSITION_ROW", productId: pid, index: idx, patch: { unit: target.value } });
      break;
    case "row-is-unit": {
      const product = store.getState().products[pid];
      if (!product) return;
      const row = product.composition[idx];
      if (!row) return;
      if (target.checked) {
        store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { unitIngredientId: row.ingredientId } });
      } else if (product.unitIngredientId === row.ingredientId) {
        store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { unitIngredientId: "", unitLabel: "" } });
      }
      break;
    }
  }
}

function handleBlurAction(store, target) {
  const action = target.dataset.blur;
  const pid = target.dataset.pid;
  const idx = target.dataset.idx ? parseInt(target.dataset.idx, 10) : null;
  const value = target.value;

  switch (action) {
    case "product-name":
      store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { name: value.trim() } });
      break;
    case "row-name": {
      const state = store.getState();
      const product = state.products[pid];
      if (!product) return;
      const row = product.composition[idx];
      if (!row) return;
      const currentIng = state.ingredients[row.ingredientId];
      if (!currentIng) return;
      const newName = value.trim();
      if (newName === currentIng.name) return;

      const existing = findIngredientByName(state, newName, currentIng.kind);
      if (existing && existing.id !== currentIng.id) {
        store.dispatch({ type: "REPLACE_COMPOSITION_INGREDIENT", productId: pid, index: idx, newIngredientId: existing.id });
      } else {
        store.dispatch({ type: "UPDATE_INGREDIENT", ingredientId: currentIng.id, patch: { name: newName } });
      }
      break;
    }
    case "row-display-name": {
      const state = store.getState();
      const product = state.products[pid];
      if (!product) return;
      const row = product.composition[idx];
      if (!row) return;
      store.dispatch({ type: "UPDATE_INGREDIENT", ingredientId: row.ingredientId, patch: { displayName: value.trim() } });
      break;
    }
    case "row-weight": {
      const state = store.getState();
      const product = state.products[pid];
      if (!product) return;
      const row = product.composition[idx];
      if (!row) return;
      const newWeight = parseWeightInput(value, row.unit);
      store.dispatch({ type: "UPDATE_COMPOSITION_ROW", productId: pid, index: idx, patch: { weight: newWeight } });
      break;
    }
    case "row-unit-name":
      store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { unitLabel: value.trim() } });
      break;
  }
}
