// ui-tab-result.js — 결과 탭
//
// 책임: 제품 선택 → 환산 중량/원가 계산 카드, 프리셋 저장
// 의존: store, selectors

import { getProductList, getResultCardData } from "./selectors.js?v=20260513-excel-multiblock-1";
import { esc, fmt, fmtInt } from "./utils.js?v=20260513-excel-multiblock-1";
import { toast } from "./ui-shell.js?v=20260513-excel-multiblock-1";

export function initResultTab(store) {
  const chipsEl = document.getElementById("productChips");
  const areaEl = document.getElementById("resultArea");

  function flush() {
    if (document.activeElement && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) {
      document.activeElement.blur();
    }
  }

  // chip 클릭
  chipsEl.addEventListener("click", e => {
    const chip = e.target.closest("[data-pid]");
    if (!chip) return;
    flush();
    store.dispatch({ type: "TOGGLE_SELECTED_PRODUCT", productId: chip.dataset.pid });
  });

  // 결과 카드 안 이벤트
  areaEl.addEventListener("click", e => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    flush();
    if (target.dataset.action === "save-preset") {
      savePreset(store, target.dataset.pid);
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

  const RERENDER_ON = [
    "TOGGLE_SELECTED_PRODUCT", "UPDATE_RESULT_OPTION",
    "ADD_PRODUCT", "REMOVE_PRODUCT",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "UPDATE_INGREDIENT", "UPDATE_COMPOSITION_ROW", "UPDATE_PRODUCT",
    "UPDATE_PRICE", "ADD_PRESET",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "result") return;
    const state = store.getState();
    const products = getProductList(state).filter(p => p.name);

    chipsEl.innerHTML = products.length
      ? products.map(p => `
          <button class="chip ${state.ui.selectedProductIds.includes(p.id) ? "selected" : ""}" data-pid="${p.id}">
            ${esc(p.displayName)}
          </button>`).join("")
      : '<span class="empty" style="display:block;width:100%">등록된 제품이 없습니다.</span>';

    if (!state.ui.selectedProductIds.length) {
      areaEl.innerHTML = "";
      return;
    }

    areaEl.innerHTML = `<div class="result-grid">${
      state.ui.selectedProductIds
        .map(pid => renderCard(state, pid))
        .filter(Boolean).join("")
    }</div>`;
  }

  render();
}

function renderCard(state, productId) {
  const data = getResultCardData(state, productId);
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
      <span class="ratio-badge">${info.hasInput ? `× ${fmt(info.ratio)}` : "× -"}</span>
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
        <div class="rcard-name">${esc(pv.displayName)}</div>
        ${unitCtrl}
      </div>
      <div class="result-actions">
        <input type="text"
          data-blur="result-preset-label" data-pid="${productId}"
          value="${esc(opt.presetLabel || "")}" placeholder="프리셋명(선택)"
          style="max-width:180px;border:0.5px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--bg2);color:var(--text)">
        <button class="btn btn-primary" data-action="save-preset" data-pid="${productId}">프리셋 저장</button>
      </div>
      <div style="padding:0 18px 10px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="suponly-${productId}"
          data-change="result-sup-only" data-pid="${productId}" ${opt.supplementOnly ? "checked" : ""}>
        <label for="suponly-${productId}" style="font-size:12px;color:var(--text2)">영양제만 보기</label>
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

function handleChange(store, target) {
  const change = target.dataset.change;
  const pid = target.dataset.pid;
  switch (change) {
    case "result-unit":
      store.dispatch({ type: "UPDATE_RESULT_OPTION", productId: pid, patch: { unitIngredientId: target.value } });
      break;
    case "result-sup-only":
      store.dispatch({ type: "UPDATE_RESULT_OPTION", productId: pid, patch: { supplementOnly: target.checked } });
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

