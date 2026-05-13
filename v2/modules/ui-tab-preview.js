// ui-tab-preview.js — 출력 미리보기 탭
//
// 책임: orderQuantities를 표로 정리해서 출력용 화면
// 의존: store, selectors

import { getOrderPreviewRows } from "./selectors.js";
import { esc } from "./utils.js";

export function initPreviewTab(store) {
  const areaEl = document.getElementById("previewArea");

  const RERENDER_ON = [
    "SET_ORDER_QUANTITY", "REMOVE_PRESET", "CLEAR_ALL_PRESETS",
    "UPDATE_INGREDIENT", "UPDATE_PRODUCT",
    "IMPORT_PRODUCTS", "RESTORE_SNAPSHOT",
    "SET_ACTIVE_TAB"
  ];
  RERENDER_ON.forEach(type => store.subscribe(type, render));

  function render() {
    if (store.getState().ui.activeTab !== "preview") return;
    const rows = getOrderPreviewRows(store.getState());

    if (!rows.length) {
      areaEl.innerHTML = '<div class="empty">입력된 부족 수량이 없습니다.</div>';
      return;
    }

    const today = new Date().toLocaleDateString("ko-KR");
    areaEl.innerHTML = `
      <div class="preview-box">
        <div class="preview-title">영양제 발주 목록</div>
        <div class="preview-sub">${today}</div>
        <table class="pv-table">
          <thead>
            <tr>
              <th>코드</th>
              <th class="left">제품/프리셋</th>
              <th class="left">영양제</th>
              <th>수량</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${esc(r.code)}</td>
                <td class="left">${esc(r.presetName)}</td>
                <td class="left">${esc(r.supplementName)}</td>
                <td>${r.qty}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  render();
}
