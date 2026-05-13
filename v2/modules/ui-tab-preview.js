// ui-tab-preview.js - A4 printable output views for selected order presets.

import { getSelectedPresetsView } from "./selectors.js?v=20260513-result-global-supp-only-1";
import { esc, fmt } from "./utils.js?v=20260513-result-global-supp-only-1";

const EGGSHELL_RE = /난각/;

export function initPreviewTab(store) {
  const areaEl = document.getElementById("previewArea");
  let activeView = "view1";

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

  areaEl.addEventListener("click", e => {
    const tab = e.target.closest("[data-preview-tab]");
    if (tab) {
      activeView = tab.dataset.previewTab || "view1";
      render();
      return;
    }

    const printBtn = e.target.closest("[data-print-view]");
    if (!printBtn) return;
    const sheet = document.getElementById(printBtn.dataset.printView);
    if (!sheet) return;
    document.querySelectorAll(".print-sheet").forEach(el => el.classList.remove("print-active"));
    sheet.classList.add("print-active");
    window.print();
    setTimeout(() => sheet.classList.remove("print-active"), 300);
  });

  function render() {
    if (store.getState().ui.activeTab !== "preview") return;
    const views = getSelectedPresetsView(store.getState());

    if (!views.length) {
      areaEl.innerHTML = '<div class="empty">발주 탭에서 프리셋을 선택해 주세요.</div>';
      return;
    }

    areaEl.innerHTML = `
      <div class="preview-tabs">
        <button class="preview-tab ${activeView === "view1" ? "active" : ""}" data-preview-tab="view1">출력 1</button>
        <button class="preview-tab ${activeView === "view2" ? "active" : ""}" data-preview-tab="view2">출력 2</button>
      </div>
      <div class="preview-actions">
        <button class="btn btn-primary" data-print-view="${activeView === "view1" ? "printView1" : "printView2"}">인쇄</button>
      </div>
      <div class="${activeView === "view1" ? "" : "hidden"}">
        <div class="preview-box print-sheet" id="printView1">
          ${renderOutputOne(views)}
        </div>
      </div>
      <div class="${activeView === "view2" ? "" : "hidden"}">
        <div class="preview-box print-sheet" id="printView2">
          ${renderOutputTwo(views)}
        </div>
      </div>`;
  }

  render();
}

function renderOutputOne(views) {
  const groups = groupByProduct(views);
  return groups.map(group => `
    <table class="pv-table pv-output-table pv-a4-table">
      <thead>
        <tr><th colspan="${group.views.length + 1}" class="pv-product-title">${esc(group.name)}</th></tr>
        <tr>
          <th></th>
          ${group.views.map(view => `<th>${esc(view.preset.code)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="left">난각분</td>
          ${group.views.map(view => `<td>${formatWeight(getEggshellWeight(view))}</td>`).join("")}
        </tr>
      </tbody>
    </table>
  `).join("");
}

function renderOutputTwo(views) {
  return `
    ${renderEggshellOnlyTable(views)}
    ${renderGroupedAliasTables(views)}
  `;
}

function renderEggshellOnlyTable(views) {
  const weights = views
    .map(getEggshellWeight)
    .filter(weight => Number(weight) > 0)
    .sort((a, b) => b - a);

  if (!weights.length) return "";

  return `
    <table class="pv-table pv-output-table pv-eggshell-only">
      <thead><tr><th>난각분</th></tr></thead>
      <tbody>
        ${weights.map(weight => `<tr><td>${fmt(weight)}g</td></tr>`).join("")}
      </tbody>
    </table>`;
}

function renderGroupedAliasTables(views) {
  return groupByCodePrefix(views).map(group => {
    const rows = getAliasSupplementRows(group.views);
    if (!rows.length) return "";
    return `
      <div class="preview-preset-block">
        <div class="preview-group-name">${esc(group.name)}</div>
        <table class="pv-table pv-output-table pv-a4-table">
          <thead>
            <tr>
              <th class="left">치환명</th>
              ${group.views.map(view => `<th>${esc(view.preset.code)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td class="left">${esc(row.displayName)}</td>
                ${group.views.map(view => `<td>${formatWeight(row.weightsByPresetId[view.preset.id])}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }).join("");
}

function groupByProduct(views) {
  const map = new Map();
  views.forEach(view => {
    const name = getProductLabel(view.product);
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(view);
  });
  return Array.from(map.entries())
    .map(([name, groupViews]) => ({ name, views: sortViewsByCode(groupViews) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function groupByCodePrefix(views) {
  const map = new Map();
  views.forEach(view => {
    const prefix = getCodePrefix(view.preset.code);
    if (!map.has(prefix)) map.set(prefix, []);
    map.get(prefix).push(view);
  });
  return Array.from(map.entries())
    .map(([name, groupViews]) => ({ name, views: sortViewsByCode(groupViews) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function sortViewsByCode(views) {
  return views.slice().sort((a, b) => compareCodes(a.preset.code, b.preset.code));
}

function getAliasSupplementRows(views) {
  const rows = new Map();
  views.forEach(view => {
    view.supplements.forEach(s => {
      if (EGGSHELL_RE.test(s.name)) return;
      if (!hasAlias(s)) return;
      const displayName = s.displayName || s.name;
      if (!rows.has(displayName)) rows.set(displayName, { displayName, weightsByPresetId: {} });
      rows.get(displayName).weightsByPresetId[view.preset.id] = s.scaledWeight;
    });
  });
  return Array.from(rows.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
}

function getEggshellWeight(view) {
  const row = view.supplements.find(s => EGGSHELL_RE.test(s.name));
  return row ? row.scaledWeight : 0;
}

function hasAlias(supplement) {
  const raw = String(supplement.name || "").trim();
  const display = String(supplement.displayName || "").trim();
  return display && display !== raw;
}

function getCodePrefix(code) {
  const match = String(code || "").trim().match(/^[A-Za-z]+/);
  return match ? match[0].toUpperCase() : "기타";
}

function compareCodes(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ko", { numeric: true, sensitivity: "base" });
}

function formatWeight(value) {
  return Number(value) > 0 ? `${fmt(value)}g` : "";
}

function getProductLabel(product) {
  if (!product) return "";
  const prefix = product.species === "cat" ? "(고양이)" : product.species === "dog" ? "(강아지)" : "";
  return `${prefix}${product.name || ""}`;
}
