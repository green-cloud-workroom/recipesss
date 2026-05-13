// ui-tab-result.js - left recipe tree and multiple open result cards.

import { getProductList, getResultCardData } from "./selectors.js?v=20260513-result-global-supp-only-1";
import { esc, fmt, fmtInt } from "./utils.js?v=20260513-result-global-supp-only-1";
import { toast } from "./ui-shell.js?v=20260513-result-global-supp-only-1";

export function initResultTab(store) {
  const menuEl = document.getElementById("productChips");
  const areaEl = document.getElementById("resultArea");
  const selectedCountEl = document.getElementById("selectedResultCount");
  const supplementOnlyEl = document.getElementById("resultSupplementOnly");
  let supplementOnly = false;

  function flush() {
    if (document.activeElement && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) {
      document.activeElement.blur();
    }
  }

  menuEl.addEventListener("click", e => {
    const productBtn = e.target.closest("[data-pid]");
    if (productBtn) {
      flush();
      store.dispatch({ type: "TOGGLE_SELECTED_PRODUCT", productId: productBtn.dataset.pid });
      return;
    }

    const actionBtn = e.target.closest("[data-menu-action]");
    if (!actionBtn) return;
    const productIds = getProductList(store.getState()).filter(p => p.name).map(p => p.id);
    store.dispatch({
      type: "SET_SELECTED_PRODUCTS",
      productIds: actionBtn.dataset.menuAction === "open-all" ? productIds : []
    });
  });

  areaEl.addEventListener("click", e => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    flush();
    if (target.dataset.action === "save-preset") {
      savePreset(store, target.dataset.pid);
    }
    if (target.dataset.action === "close-result") {
      store.dispatch({ type: "TOGGLE_SELECTED_PRODUCT", productId: target.dataset.pid });
    }
  });

  areaEl.addEventListener("change", e => {
    const target = e.target.closest("[data-change]");
    if (!target) return;
    handleChange(store, target);
  });

  areaEl.addEventListener("blur", e => {
    const target = e.target.closest("[data-blur]");
    if (!target) return;
    handleBlur(store, target);
  }, true);

  supplementOnlyEl?.addEventListener("change", () => {
    supplementOnly = supplementOnlyEl.checked;
    render();
  });

  const RERENDER_ON = [
    "TOGGLE_SELECTED_PRODUCT", "SET_SELECTED_PRODUCTS", "UPDATE_RESULT_OPTION",
    "ADD_PRODUCT", "REMOVE_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "UPDATE_INGREDIENT", "UPDATE_COMPOSITION_ROW", "UPDATE_PRODUCT",
    "UPDATE_PRICE", "ADD_PRESET",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT", "REMOTE_SYNC",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "result") return;
    const state = store.getState();
    const products = getProductList(state).filter(p => p.name);
    const validIds = new Set(products.map(p => p.id));
    const selectedIds = (state.ui.selectedProductIds || []).filter(id => validIds.has(id));

    if (selectedIds.length !== (state.ui.selectedProductIds || []).length) {
      store.dispatch({ type: "SET_SELECTED_PRODUCTS", productIds: selectedIds });
      return;
    }

    if (selectedCountEl) selectedCountEl.textContent = selectedIds.length;
    if (supplementOnlyEl) supplementOnlyEl.checked = supplementOnly;
    menuEl.innerHTML = products.length
      ? renderProductMenu(products, new Set(selectedIds))
      : '<div class="empty">등록된 제품이 없습니다.</div>';

    if (!selectedIds.length) {
      areaEl.className = "";
      areaEl.innerHTML = '<div class="empty">왼쪽 레시피 목록에서 결과를 볼 제품을 선택해 주세요.</div>';
      return;
    }

    areaEl.className = "result-grid";
    areaEl.innerHTML = selectedIds
      .map(pid => renderCard(state, pid, supplementOnly))
      .filter(Boolean)
      .join("");
  }

  render();
}

function renderProductMenu(products, selectedIds) {
  const groups = buildMenuGroups(products);
  return `
    <div class="recipe-menu-actions">
      <button class="btn btn-sm" data-menu-action="open-all">전체 열기</button>
      <button class="btn btn-sm" data-menu-action="close-all">전체 닫기</button>
    </div>
    ${groups.map(group => `
      <section class="recipe-menu-section">
        <div class="recipe-menu-heading">
          <span>${esc(group.label)}</span>
          <span>${group.products.length}</span>
        </div>
        <div class="recipe-menu-items">
          ${group.products.map(product => renderMenuProduct(product, selectedIds.has(product.id))).join("")}
        </div>
      </section>
    `).join("")}`;
}

function buildMenuGroups(products) {
  const groups = [
    { label: "고양이", products: products.filter(product => product.species === "cat") },
    { label: "강아지", products: products.filter(product => product.species === "dog") },
    { label: "공용/기타", products: products.filter(product => !product.species) }
  ];
  return groups.filter(group => group.products.length);
}

function renderMenuProduct(product, isSelected) {
  const title = product.displayName || "이름 없는 제품";
  const frozenTag = /동결/.test(product.name || product.displayName || "") ? '<span class="recipe-menu-tag">동결</span>' : "";
  return `
    <button class="recipe-menu-item ${isSelected ? "active" : ""}" data-pid="${product.id}">
      <span class="recipe-menu-name">${esc(title)}</span>
      ${frozenTag}
    </button>`;
}

function renderCard(state, productId, supplementOnly) {
  const stateForCard = withSupplementOnly(state, productId, supplementOnly);
  const data = getResultCardData(stateForCard, productId);
  if (!data) return "";
  const { productView: pv, info, rows, totalWeight, totalCost, unitOptions, opt } = data;

  const unitCtrl = unitOptions.length ? `
    <div class="unit-ctrl">
      <select class="unit-select" data-change="result-unit" data-pid="${productId}">
        ${unitOptions.map(u => `
          <option value="${u.ingredientId}" ${u.ingredientId === (opt.unitIngredientId || pv.unitIngredientId) ? "selected" : ""}>
            ${esc(u.name)} 기준 ${fmt(u.weight)}g${u.unitName ? `/${esc(u.unitName)}` : ""}
          </option>`).join("")}
      </select>
      <div class="unit-input-wrap">
        <input class="unit-weight-input" type="number"
          data-blur="result-weight" data-pid="${productId}"
          value="${esc(opt.weight || "")}" placeholder="0" min="0" step="0.1">
        <span>${esc(info.inputUnitLabel || info.unitRow?.unit || "g")}</span>
      </div>
      <span class="ratio-badge">${info.hasInput ? `x ${fmt(info.ratio)}` : "x -"}</span>
    </div>` : `<div style="font-size:12px;color:var(--text3)">생산단위 원료를 먼저 체크해 주세요.</div>`;

  const bodyRows = rows.length ? rows.map(r => `
    <tr>
      <td>${esc(r.displayName)} <span style="font-size:10px;color:var(--text3)">(${esc(r.name)})</span></td>
      <td style="text-align:right">${fmt(r.scaledWeight)}g</td>
      <td style="text-align:right">${fmtInt(r.cost)}원</td>
    </tr>`).join("") : '<tr><td colspan="3" class="empty">표시할 항목이 없습니다.</td></tr>';

  return `
    <div class="rcard">
      <div class="rcard-head">
        <div class="rcard-title-row">
          <div class="rcard-name">${esc(pv.displayName)}</div>
          <button class="btn btn-sm" data-action="close-result" data-pid="${productId}">닫기</button>
        </div>
        ${unitCtrl}
      </div>
      <div class="result-actions">
        <input type="text"
          data-blur="result-preset-label" data-pid="${productId}"
          value="${esc(opt.presetLabel || "")}" placeholder="프리셋명(선택)"
          style="max-width:180px;border:0.5px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--bg2);color:var(--text)">
        <button class="btn btn-primary" data-action="save-preset" data-pid="${productId}">프리셋 저장</button>
      </div>
      <div class="rcard-body">
        <table>
          <thead><tr><th>항목</th><th style="text-align:right">중량</th><th style="text-align:right">원가</th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <div class="rcard-foot">
        <div style="font-size:12px;color:var(--text2)">기준 중량에 맞춰 자동 계산됩니다.</div>
        <div class="foot-item"><div class="foot-label">총 중량</div><div class="foot-val">${fmt(totalWeight)}g</div></div>
        <div class="foot-item"><div class="foot-label">총 원가</div><div class="foot-val">${fmtInt(totalCost)}원</div></div>
      </div>
    </div>`;
}

function withSupplementOnly(state, productId, supplementOnly) {
  const current = state.ui.resultOptions[productId] || {};
  return {
    ...state,
    ui: {
      ...state.ui,
      resultOptions: {
        ...state.ui.resultOptions,
        [productId]: {
          ...current,
          supplementOnly
        }
      }
    }
  };
}

function handleChange(store, target) {
  const change = target.dataset.change;
  const pid = target.dataset.pid;
  switch (change) {
    case "result-unit":
      store.dispatch({ type: "UPDATE_RESULT_OPTION", productId: pid, patch: { unitIngredientId: target.value } });
      break;
  }
}

function handleBlur(store, target) {
  const blur = target.dataset.blur;
  const pid = target.dataset.pid;
  switch (blur) {
    case "result-weight":
      store.dispatch({ type: "UPDATE_RESULT_OPTION", productId: pid, patch: { weight: target.value } });
      break;
    case "result-preset-label":
      store.dispatch({ type: "UPDATE_RESULT_OPTION", productId: pid, patch: { presetLabel: target.value.trim() } });
      break;
  }
}

function savePreset(store, productId) {
  const state = store.getState();
  const product = state.products[productId];
  if (!product || !product.name) {
    toast("제품명을 먼저 입력해 주세요");
    return;
  }
  const data = getResultCardData(state, productId);
  if (!data || !data.info.hasInput || !data.info.targetWeight) {
    toast("중량을 먼저 입력해 주세요");
    return;
  }
  const opt = data.opt;
  store.dispatch({
    type: "ADD_PRESET",
    productId,
    targetWeight: data.info.targetWeight,
    label: opt.presetLabel || "",
    unitIngredientId: opt.unitIngredientId || product.unitIngredientId,
    inputAmount: data.info.inputAmount,
    inputUnitLabel: data.info.inputUnitLabel
  });
  toast("프리셋 저장 완료");
}
