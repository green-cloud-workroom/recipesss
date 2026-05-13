// ui-tab-recipe.js — 레시피 탭
//
// 책임: 제품 목록 카드 렌더링, 인라인 편집, 행 추가/삭제
// 의존: store, selectors, utils
//
// 렌더 전략:
//   - fullRender: 카드 전체 재구성. 구조 변경 액션(제품/행 추가·삭제, 편집 모드 전환)에만 호출.
//   - 텍스트/숫자 입력은 blur 시점에 dispatch → state만 갱신, DOM은 안 건드림.
//   - 외부 액션 전에 활성 input을 blur로 flush.

import { getProductList, findIngredientByName } from "./selectors.js?v=20260513-preset-display-1";
import { esc, parseWeightInput, displayWeight } from "./utils.js?v=20260513-preset-display-1";
import { toast } from "./ui-shell.js?v=20260513-preset-display-1";

export function initRecipeTab(store) {
  const listEl = document.getElementById("productList");
  const countEl = document.getElementById("productCount");
  const addBtn = document.getElementById("addProductBtn");

  // 외부 액션 전 활성 input flush
  function flush() {
    if (document.activeElement && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) {
      document.activeElement.blur();
    }
  }

  addBtn.addEventListener("click", () => {
    flush();
    store.dispatch({ type: "ADD_PRODUCT" });
  });

  // 이벤트 위임: 카드 안의 모든 동작
  listEl.addEventListener("click", e => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    flush();
    handleClickAction(store, target, e);
  });

  listEl.addEventListener("change", e => {
    const target = e.target.closest("[data-change]");
    if (!target) return;
    handleChangeAction(store, target, e);
  });

  // blur는 capture로 잡아야 (blur는 버블 안 됨)
  listEl.addEventListener("blur", e => {
    const target = e.target.closest("[data-blur]");
    if (!target) return;
    handleBlurAction(store, target, e);
  }, true);

  // 구조 변경 액션에만 fullRender
  const RERENDER_ON = [
    "ADD_PRODUCT", "REMOVE_PRODUCT", "SET_EDITING_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    const state = store.getState();
    const products = getProductList(state);
    countEl.textContent = products.length;

    if (!products.length) {
      listEl.className = "";
      listEl.innerHTML = '<div class="empty">제품을 추가해 주세요.</div>';
      return;
    }

    listEl.className = "product-list";
    listEl.innerHTML = products.map(p => renderCard(p, state.ui.editingProductId === p.id)).join("");
  }

  render(); // 초기
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
        value="${esc(product.name)}" placeholder="제품명 (접두어 빼고)">
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

  if (!rows.length) {
    return `<div class="empty-row">행이 없습니다.</div>`;
  }

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
  // 행 식별: product.composition 배열 내 index. 그러나 ingredientRows는 filter된 결과라
  // 원본 composition 내 실제 index를 찾으려면 selector에서 같이 줘야 한다. row.index 사용.
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
  const cellRemove = `
    <td><button class="btn-icon" data-action="remove-row" data-pid="${productId}" data-idx="${row.index}" title="삭제">✕</button></td>`;
  const cellUnitName = kind === "ingredient" ? `
    <td><input type="text"
        data-blur="row-unit-name" data-pid="${productId}" data-idx="${row.index}"
        value="${esc(row.isUnit ? (row.unitName || "") : "")}"
        placeholder="${row.isUnit ? "마리/개 등" : ""}" ${row.isUnit ? "" : "disabled"}></td>` : "";

  return `<tr>
    ${cellName}
    ${cellDisplayName}
    ${cellWeight}
    ${cellIsUnit}
    ${cellUnitName}
    ${cellRemove}
  </tr>`;
}

// ===== 이벤트 핸들러 =====

function handleClickAction(store, target, _event) {
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

function handleChangeAction(store, target, _event) {
  const action = target.dataset.change;
  const pid = target.dataset.pid;
  const idx = target.dataset.idx ? parseInt(target.dataset.idx, 10) : null;

  switch (action) {
    case "species":
      store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { species: target.value || null } });
      break;
    case "row-unit": {
      store.dispatch({ type: "UPDATE_COMPOSITION_ROW", productId: pid, index: idx, patch: { unit: target.value } });
      break;
    }
    case "row-is-unit": {
      const product = store.getState().products[pid];
      if (!product) return;
      const row = product.composition[idx];
      if (!row) return;
      if (target.checked) {
        // 이 ingredient를 unitIngredientId로 설정
        store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { unitIngredientId: row.ingredientId } });
      } else {
        // 해제: 같은 ingredient를 가리키고 있으면 클리어
        if (product.unitIngredientId === row.ingredientId) {
          store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { unitIngredientId: "", unitLabel: "" } });
        }
      }
      break;
    }
  }
}

function handleBlurAction(store, target, _event) {
  const action = target.dataset.blur;
  const pid = target.dataset.pid;
  const idx = target.dataset.idx ? parseInt(target.dataset.idx, 10) : null;
  const value = target.value;

  switch (action) {
    case "product-name":
      store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { name: value.trim() } });
      break;
    case "row-name": {
      // 이름이 바뀌면 ingredient를 어떻게 처리할지 결정:
      //   1) 같은 kind에 같은 이름의 기존 ingredient가 있으면 → 그 ingredient로 교체 (머지)
      //   2) 없으면 → 현재 ingredient의 name을 rename
      // 단순화: 다른 제품에서 같은 ingredient를 쓰고 있어도 rename으로 동기화. 의도된 동작.
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
    case "row-unit-name": {
      // unitLabel은 product 레벨 (현재 모델). 첫 번째 unit ingredient에만 의미 있음.
      store.dispatch({ type: "UPDATE_PRODUCT", productId: pid, patch: { unitLabel: value.trim() } });
      break;
    }
  }
}

