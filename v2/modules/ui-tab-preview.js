// ui-tab-preview.js — 출력 탭 (v2.1)
//
// 변경: orderQuantities(부족 수량) → 선택된 프리셋들의 영양제 일람표.
// 인쇄/공유용 깔끔한 형태. 프리셋별로 그룹화.

import { getSelectedPresetsView } from "./selectors.js?v=20260513-alias-style-1";
import { esc, fmt } from "./utils.js?v=20260513-alias-style-1";

export function initPreviewTab(store) {
  const areaEl = document.getElementById("previewArea");

  const RERENDER_ON = [
    "TOGGLE_SELECTED_PRESET", "SET_SELECTED_PRESETS",
    "REMOVE_PRESET", "CLEAR_ALL_PRESETS",
    "UPDATE_INGREDIENT", "UPDATE_PRODUCT", "UPDATE_COMPOSITION_ROW",
    "ADD_COMPOSITION_ROW", "REMOVE_COMPOSITION_ROW",
    "REPLACE_COMPOSITION_INGREDIENT",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "preview") return;
    const views = getSelectedPresetsView(store.getState());

    if (!views.length) {
      areaEl.innerHTML = '<div class="empty">발주 탭에서 프리셋을 선택해 주세요.</div>';
      return;
    }

    const today = new Date().toLocaleDateString("ko-KR");
    areaEl.innerHTML = `
      <div class="preview-box">
        <div class="preview-title">영양제 분배 목록</div>
        <div class="preview-sub">${today} · ${views.length}개 프리셋</div>
        ${views.map(v => `
          <div class="preview-preset-block">
            <div class="preview-preset-head">
              <span class="badge">${esc(v.preset.code)}</span>
              <span class="preview-preset-name">${esc(v.displayName)}</span>
            </div>
            ${v.supplements.length ? `
              <table class="pv-table">
                <thead><tr><th class="left">영양제</th><th>중량</th></tr></thead>
                <tbody>
                  ${v.supplements.map(s => `
                    <tr>
                      <td class="left">${esc(s.displayName)}${s.displayName !== s.name ? ` <span class="pv-sub">(${esc(s.name)})</span>` : ""}</td>
                      <td>${fmt(s.scaledWeight)}g</td>
                    </tr>`).join("")}
                </tbody>
              </table>
            ` : '<div class="empty">영양제가 등록되어 있지 않습니다.</div>'}
          </div>
        `).join("")}
      </div>`;
  }

  render();
}

