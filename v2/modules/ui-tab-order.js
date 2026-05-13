// ui-tab-order.js — 발주 탭 (v2.1)
//
// 변경 사항:
//   - 왼쪽 프리셋 카드: 클릭으로 선택/해제 (토글)
//   - 오른쪽: 선택된 프리셋만 표시. 선택 안 됐으면 안내.
//   - 셀: 그램 수치만 표시. 부족 수량 input/라벨 제거.
//   - 셀 padding 축소로 자동으로 좁아짐.

import { getPresetsByProduct, getPresetDisplayName, getPresetRatio, getProductView } from "./selectors.js?v=20260513-alias-sort-1";
import { esc, fmt } from "./utils.js?v=20260513-alias-sort-1";
import { toast } from "./ui-shell.js?v=20260513-alias-sort-1";

export function initOrderTab(store) {
  const presetGrid = document.getElementById("presetGrid");
  const supMapTable = document.getElementById("supMapTable");
  const orderArea = document.getElementById("orderArea");

  document.getElementById("clearPresetsBtn")?.addEventListener("click", () => {
    if (confirm("저장된 모든 프리셋을 초기화할까요?")) {
      store.dispatch({ type: "CLEAR_ALL_PRESETS" });
      toast("프리셋 초기화 완료");
    }
  });

  document.getElementById("generatePreviewBtn")?.addEventListener("click", () => {
    const selected = store.getState().ui.selectedPresetIds || [];
    if (!selected.length) {
      toast("프리셋을 먼저 선택해 주세요");
      return;
    }
    store.dispatch({ type: "SET_ACTIVE_TAB", tab: "preview" });
  });

  document.getElementById("clearUnusedSupplementsBtn")?.addEventListener("click", () => {
    const unused = getUnusedSupplements(store.getState());
    if (!unused.length) {
      toast("삭제할 미사용 영양제가 없습니다");
      return;
    }
    if (confirm(`미사용 영양제 ${unused.length}개와 해당 단가를 삭제할까요?`)) {
      store.dispatch({ type: "REMOVE_ALL_UNUSED_SUPPLEMENTS" });
      toast(`미사용 영양제 ${unused.length}개 삭제 완료`);
    }
  });

  // 왼쪽 프리셋 카드 클릭 (선택 토글 또는 삭제)
  presetGrid.addEventListener("click", e => {
    const removeBtn = e.target.closest("[data-action='remove-preset']");
    if (removeBtn) {
      e.stopPropagation();
      if (confirm("이 프리셋을 삭제할까요?")) {
        store.dispatch({ type: "REMOVE_PRESET", presetId: removeBtn.dataset.preset });
      }
      return;
    }
    const line = e.target.closest("[data-preset]");
    if (line && line.dataset.preset) {
      store.dispatch({ type: "TOGGLE_SELECTED_PRESET", presetId: line.dataset.preset });
    }
  });

  supMapTable.addEventListener("click", e => {
    const toggleBtn = e.target.closest("[data-action='toggle-supplement-hidden']");
    if (toggleBtn) {
      const ing = store.getState().ingredients[toggleBtn.dataset.iid];
      if (!ing) return;
      store.dispatch({
        type: "UPDATE_INGREDIENT",
        ingredientId: ing.id,
        patch: { hidden: !ing.hidden }
      });
      return;
    }

    const btn = e.target.closest("[data-action='remove-unused-supplement']");
    if (!btn) return;
    const name = btn.dataset.name || "이 항목";
    if (confirm(`미사용 영양제 "${name}"을 삭제할까요? 해당 단가도 함께 삭제됩니다.`)) {
      store.dispatch({ type: "REMOVE_UNUSED_SUPPLEMENT", ingredientId: btn.dataset.iid });
      toast("미사용 영양제 삭제 완료");
    }
  });

  supMapTable.addEventListener("change", e => {
    const input = e.target.closest("[data-field='supplement-display-name']");
    if (!input) return;
    store.dispatch({
      type: "UPDATE_INGREDIENT",
      ingredientId: input.dataset.iid,
      patch: { displayName: input.value }
    });
  });

  // 전체 선택/해제 버튼
  document.getElementById("selectAllPresetsBtn")?.addEventListener("click", () => {
    const state = store.getState();
    const all = Object.keys(state.presets);
    const allSelected = all.length && all.every(id => (state.ui.selectedPresetIds || []).includes(id));
    store.dispatch({
      type: "SET_SELECTED_PRESETS",
      presetIds: allSelected ? [] : all
    });
  });

  const RERENDER_ON = [
    "ADD_PRESET", "REMOVE_PRESET", "CLEAR_ALL_PRESETS",
    "TOGGLE_SELECTED_PRESET", "SET_SELECTED_PRESETS",
    "REMOVE_UNUSED_SUPPLEMENT", "REMOVE_ALL_UNUSED_SUPPLEMENTS",
    "UPDATE_INGREDIENT", "UPDATE_COMPOSITION_ROW", "UPDATE_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "ADD_PRODUCT", "REMOVE_PRODUCT",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT", "REMOTE_SYNC",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "order") return;
    const state = store.getState();
    const grouped = getPresetsByProduct(state);
    const productIds = [
      ...(state.productOrder || []).filter(id => grouped[id]),
      ...Object.keys(grouped).filter(id => !(state.productOrder || []).includes(id))
    ];
    const selectedIds = state.ui.selectedPresetIds || [];
    const selectedSet = new Set(selectedIds);

    // 왼쪽 프리셋 카드
    presetGrid.innerHTML = productIds.length ? productIds.map(pid => {
      const product = state.products[pid];
      const list = grouped[pid];
      return `
        <div class="preset-card">
          <div class="preset-card-name"><span>${esc(product ? product.name : "?")}</span></div>
          <div class="preset-lines">
            ${list.map(preset => {
              const sel = selectedSet.has(preset.id);
              return `
                <div class="preset-line ${sel ? "selected" : ""}" data-preset="${preset.id}">
                  <span class="badge">${esc(preset.code)}</span>
                  <span class="preset-line-name">${esc(getPresetDisplayName(state, preset))}</span>
                  <button class="btn-icon" data-action="remove-preset" data-preset="${preset.id}" title="삭제">✕</button>
                </div>`;
            }).join("")}
          </div>
        </div>`;
    }).join("") : '<div class="empty">저장된 프리셋이 없습니다.</div>';

    // 영양제 치환명 표
    const aliasRows = Object.values(state.ingredients)
      .filter(ing => ing.kind === "supplement" && ing.name)
      .map(ing => ({
        ing,
        used: isSupplementUsed(state, ing.id),
        hidden: Boolean(ing.hidden),
        alias: getAliasValue(ing)
      }))
      .sort(compareAliasRows)
      .map(({ ing, used, hidden, alias }) => {
        return `
          <tr class="${hidden ? "alias-row-hidden" : ""}">
            <td>${esc(ing.name)}${hidden ? ' <span class="orphan-badge">숨김</span>' : ""}${used ? "" : ' <span class="orphan-badge">미사용</span>'}</td>
            <td>
              <input
                type="text"
                class="alias-input"
                data-field="supplement-display-name"
                data-iid="${ing.id}"
                value="${esc(alias)}"
                placeholder="${esc(ing.name)}">
            </td>
            <td class="alias-actions">
              <button class="btn-icon" data-action="toggle-supplement-hidden" data-iid="${ing.id}" title="${hidden ? "보이기" : "숨김"}">${hidden ? "보이기" : "숨김"}</button>
              ${used ? "" : `<button class="btn-icon" data-action="remove-unused-supplement" data-iid="${ing.id}" data-name="${esc(ing.name)}" title="삭제">삭제</button>`}
            </td>
          </tr>`;
      });
    supMapTable.innerHTML = aliasRows.join("") || '<tr><td colspan="3" class="empty">영양제 치환명이 없습니다.</td></tr>';

    // 오른쪽 영역
    if (!productIds.length) {
      orderArea.innerHTML = '<div class="empty">결과 탭에서 프리셋을 저장해 주세요.</div>';
      return;
    }
    if (!selectedIds.length) {
      orderArea.innerHTML = '<div class="empty">왼쪽에서 프리셋을 클릭하여 선택해 주세요.</div>';
      return;
    }

    // 선택된 프리셋들을 제품별로 그룹화
    const byProduct = {};
    selectedIds.forEach(id => {
      const preset = state.presets[id];
      if (!preset) return;
      if (!byProduct[preset.productId]) byProduct[preset.productId] = [];
      byProduct[preset.productId].push(preset);
    });
    Object.values(byProduct).forEach(arr => arr.sort((a, b) => a.targetWeight - b.targetWeight));

    orderArea.innerHTML = Object.keys(byProduct).map(pid => {
      const product = state.products[pid];
      if (!product) return "";
      const view = getProductView(state, pid);
      const presets = byProduct[pid];
      const supplements = view.supplementRows.filter(r => {
        const ing = state.ingredients[r.ingredientId];
        return r.name && r.weight > 0 && !ing?.hidden;
      });

      return `
        <div class="order-product-row">
          <div class="order-product-header">
            <span class="order-product-name">${esc(view.displayName)}</span>
            <span class="badge">${presets.length}개 프리셋</span>
          </div>
          <div class="order-table-wrap">
            <table class="order-compact">
              <thead>
                <tr>
                  <th class="order-sup-col">영양제</th>
                  ${presets.map(p => `<th class="order-col-head">${esc(p.code)}<br><span class="order-col-sub">${esc(getPresetDisplayName(state, p))}</span></th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${supplements.map(row => `
                  <tr>
                    <td class="order-sup-name">${esc(row.displayName || row.name)}</td>
                    ${presets.map(preset => {
                      const ratio = getPresetRatio(state, preset);
                      const grams = row.weight * ratio;
                      return `<td class="order-cell-compact">${fmt(grams)}<span class="order-cell-unit">g</span></td>`;
                    }).join("")}
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    }).join("");
  }

  render();
}

function isSupplementUsed(state, ingredientId) {
  return Object.values(state.products).some(product =>
    (product.composition || []).some(row => row.ingredientId === ingredientId)
  );
}

function getUnusedSupplements(state) {
  return Object.values(state.ingredients)
    .filter(ing => ing.kind === "supplement" && ing.name && !isSupplementUsed(state, ing.id));
}

function getAliasValue(ing) {
  return String(ing.displayName || ing.aliases?.[0] || "").trim();
}

function compareAliasRows(a, b) {
  if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
  const aKey = a.alias || a.ing.name;
  const bKey = b.alias || b.ing.name;
  return aKey.localeCompare(bKey, "ko", { numeric: true, sensitivity: "base" });
}

