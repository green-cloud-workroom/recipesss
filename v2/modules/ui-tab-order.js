// ui-tab-order.js — 발주 탭
//
// 책임: 프리셋 표시, 영양제별 부족 수량 입력
// 의존: store, selectors

import { getPresetsByProduct, getPresetDisplayName, getPresetRatio, getProductView } from "./selectors.js";
import { esc, fmt } from "./utils.js";
import { toast } from "./ui-shell.js";

export function initOrderTab(store) {
  const presetGrid = document.getElementById("presetGrid");
  const supMapTable = document.getElementById("supMapTable");
  const orderArea = document.getElementById("orderArea");

  document.getElementById("clearPresetsBtn")?.addEventListener("click", () => {
    if (confirm("저장된 모든 프리셋과 발주 수량을 초기화할까요?")) {
      store.dispatch({ type: "CLEAR_ALL_PRESETS" });
      toast("프리셋 초기화 완료");
    }
  });

  document.getElementById("generatePreviewBtn")?.addEventListener("click", () => {
    store.dispatch({ type: "SET_ACTIVE_TAB", tab: "preview" });
  });

  orderArea.addEventListener("change", e => {
    const target = e.target.closest("[data-change='order-qty']");
    if (!target) return;
    store.dispatch({
      type: "SET_ORDER_QUANTITY",
      presetId: target.dataset.preset,
      ingredientId: target.dataset.iid,
      amount: target.value
    });
  });

  const RERENDER_ON = [
    "ADD_PRESET", "REMOVE_PRESET", "CLEAR_ALL_PRESETS",
    "SET_ORDER_QUANTITY",
    "UPDATE_INGREDIENT", "UPDATE_COMPOSITION_ROW", "UPDATE_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "ADD_PRODUCT", "REMOVE_PRODUCT",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "order") return;
    const state = store.getState();
    const grouped = getPresetsByProduct(state);
    const productIds = Object.keys(grouped);

    // 프리셋 카드
    presetGrid.innerHTML = productIds.length ? productIds.map(pid => {
      const product = state.products[pid];
      const list = grouped[pid];
      return `
        <div class="preset-card">
          <div class="preset-card-name"><span>${esc(product ? product.name : "?")}</span></div>
          <div class="preset-lines">
            ${list.map(preset => `
              <div class="preset-line">
                <span class="badge">${esc(preset.code)}</span>
                <span>${esc(getPresetDisplayName(state, preset))}</span>
                <button class="btn-icon" data-action="remove-preset" data-preset="${preset.id}" title="삭제">✕</button>
              </div>`).join("")}
          </div>
        </div>`;
    }).join("") : '<div class="empty">저장된 프리셋이 없습니다.</div>';

    // 영양제 치환명 표
    const aliasRows = [];
    Object.values(state.ingredients)
      .filter(ing => ing.kind === "supplement" && ing.name)
      .forEach(ing => {
        aliasRows.push(`<tr><td>${esc(ing.name)}</td><td>${esc(ing.displayName || ing.name)}</td></tr>`);
      });
    supMapTable.innerHTML = aliasRows.join("") || '<tr><td colspan="2" class="empty">영양제 치환명이 없습니다.</td></tr>';

    // 발주 수량 입력
    if (!productIds.length) {
      orderArea.innerHTML = '<div class="empty">결과 탭에서 프리셋을 저장해 주세요.</div>';
      return;
    }

    orderArea.innerHTML = productIds.map(pid => {
      const product = state.products[pid];
      if (!product) return "";
      const view = getProductView(state, pid);
      const presets = grouped[pid];
      const supplements = view.supplementRows.filter(r => r.name);

      return `
        <div class="order-product-row">
          <div class="order-product-header">
            <span class="order-product-name">${esc(view.displayName)}</span>
            <span class="badge">${presets.length}개 프리셋</span>
          </div>
          <div class="order-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:180px">영양제</th>
                  ${presets.map(p => `<th style="text-align:center">${esc(p.code)}<br><span style="font-size:10px;font-weight:400">${esc(getPresetDisplayName(state, p))}</span></th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${supplements.map(row => `
                  <tr>
                    <td style="font-weight:600">${esc(row.displayName || row.name)} <span style="font-size:10px;color:var(--text3)">(${esc(row.name)})</span></td>
                    ${presets.map(preset => {
                      const ratio = getPresetRatio(state, preset);
                      const grams = row.weight * ratio;
                      const key = `${preset.id}__${row.ingredientId}`;
                      const value = state.orderQuantities[key] || "";
                      return `<td>
                        <div class="order-cell">
                          <div class="order-cell-grams">${fmt(grams)}g</div>
                          <div class="order-cell-sub">부족 수량</div>
                          <input class="order-cell-input" type="number" min="0" step="1"
                            data-change="order-qty" data-preset="${preset.id}" data-iid="${row.ingredientId}"
                            value="${esc(value)}">
                        </div>
                      </td>`;
                    }).join("")}
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    }).join("");
  }

  // 프리셋 카드 안의 삭제 버튼
  presetGrid.addEventListener("click", e => {
    const btn = e.target.closest("[data-action='remove-preset']");
    if (!btn) return;
    if (confirm("이 프리셋을 삭제할까요?")) {
      store.dispatch({ type: "REMOVE_PRESET", presetId: btn.dataset.preset });
    }
  });

  render();
}
