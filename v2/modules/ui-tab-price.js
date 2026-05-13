// ui-tab-price.js — 단가 탭
//
// 책임: 원료/영양제 단가 입력
// 의존: store, selectors

import { getPriceTableView } from "./selectors.js?v=20260513-excel-multiblock-1";
import { esc } from "./utils.js?v=20260513-excel-multiblock-1";

export function initPriceTab(store) {
  const ingTbody = document.getElementById("ingredientPriceTable");
  const supTbody = document.getElementById("supplementPriceTable");
  const ingEmpty = document.getElementById("ingredientPriceEmpty");
  const supEmpty = document.getElementById("supplementPriceEmpty");
  const hideUnusedToggle = document.getElementById("hideUnusedPrices");

  let hideUnused = Boolean(localStorage.getItem("recipe_cost_v2_hide_unused_prices") === "1");
  if (hideUnusedToggle) hideUnusedToggle.checked = hideUnused;
  hideUnusedToggle?.addEventListener("change", () => {
    hideUnused = hideUnusedToggle.checked;
    localStorage.setItem("recipe_cost_v2_hide_unused_prices", hideUnused ? "1" : "0");
    render();
  });

  // 가격 input blur 시 dispatch
  document.getElementById("tab-price").addEventListener("blur", e => {
    const target = e.target.closest("[data-blur]");
    if (!target) return;
    const ingredientId = target.dataset.iid;
    if (!ingredientId) return;
    const tr = target.closest("tr");
    const unitInput = tr.querySelector('[data-blur="price-unit"]');
    const priceInput = tr.querySelector('[data-blur="price-price"]');
    store.dispatch({
      type: "UPDATE_PRICE",
      ingredientId,
      unit: unitInput?.value || 0,
      price: priceInput?.value || 0
    });
  }, true);

  // 구조가 바뀌는 경우만 re-render (행 추가/삭제, 제품 변경 등)
  const RERENDER_ON = [
    "ADD_PRODUCT", "REMOVE_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "UPDATE_INGREDIENT", // 이름 변경 시
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "price") return;
    const groups = getPriceTableView(store.getState(), { hideUnused });
    renderGroup(ingTbody, ingEmpty, groups.ingredient, "원료");
    renderGroup(supTbody, supEmpty, groups.supplement, "영양제");
  }

  render();
}

function renderGroup(tbody, emptyEl, items, _label) {
  if (!items.length) {
    tbody.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  tbody.innerHTML = items.map(item => `
    <tr data-iid="${item.id}">
      <td style="font-weight:500">
        ${esc(item.name)}
        ${item.usageCount > 0 ? `<span class="usage-badge">×${item.usageCount}</span>` : '<span class="orphan-badge">미사용</span>'}
        ${item.displayName ? `<div class="alias-line">표시명: ${esc(item.displayName)}</div>` : ""}
      </td>
      <td>
        <input class="unit-inp" type="number"
          data-blur="price-unit" data-iid="${item.id}"
          value="${item.unit || ""}" placeholder="1000" min="0" style="text-align:right">
      </td>
      <td>
        <input class="price-inp" type="number"
          data-blur="price-price" data-iid="${item.id}"
          value="${item.price || ""}" placeholder="0" min="0" style="text-align:right">
      </td>
    </tr>`).join("");
}

