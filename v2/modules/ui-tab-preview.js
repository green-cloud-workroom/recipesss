// ui-tab-preview.js - printable output tables for selected order presets.

import { getSelectedPresetsView } from "./selectors.js?v=20260513-output-tables-1";
import { esc, fmt } from "./utils.js?v=20260513-output-tables-1";

const EGGSHELL_RE = /난각/;

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

    areaEl.innerHTML = `
      <div class="preview-box">
        ${renderEggshellTable(views)}
        ${renderGroupedSupplementTables(views)}
      </div>`;
  }

  render();
}

function renderEggshellTable(views) {
  const rows = views
    .map(view => {
      const eggshell = view.supplements.find(s => EGGSHELL_RE.test(s.name));
      if (!eggshell) return null;
      return {
        code: view.preset.code,
        productName: getProductLabel(view.product),
        supplementName: eggshell.displayName || eggshell.name,
        weight: eggshell.scaledWeight
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code));

  if (!rows.length) return "";

  return `
    <table class="pv-table pv-output-table">
      <thead>
        <tr>
          <th>코드</th>
          <th>제품</th>
          <th>영양제</th>
          <th>중량</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${esc(row.code)}</td>
            <td>${esc(row.productName)}</td>
            <td>${esc(row.supplementName)}</td>
            <td>${fmt(row.weight)}g</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderGroupedSupplementTables(views) {
  const groups = groupByCodePrefix(views);
  return groups.map(group => {
    const supplementRows = getDisplaySupplementRows(group.views);
    if (!supplementRows.length) return "";
    return `
      <div class="preview-preset-block">
        <div class="preview-group-name">${esc(group.name)}</div>
        <table class="pv-table pv-output-table">
          <thead>
            <tr>
              <th class="left">치환명</th>
              ${group.views.map(view => `<th>${esc(view.preset.code)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${supplementRows.map(row => `
              <tr>
                <td class="left">${esc(row.displayName)}</td>
                ${group.views.map(view => `<td>${formatWeight(row.weightsByPresetId[view.preset.id])}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }).join("");
}

function groupByCodePrefix(views) {
  const map = new Map();
  views.forEach(view => {
    const prefix = getCodePrefix(view.preset.code);
    if (!map.has(prefix)) map.set(prefix, []);
    map.get(prefix).push(view);
  });
  return Array.from(map.entries())
    .map(([name, groupViews]) => ({
      name,
      views: groupViews.slice().sort((a, b) => compareCodes(a.preset.code, b.preset.code))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function getDisplaySupplementRows(views) {
  const rows = new Map();
  views.forEach(view => {
    view.supplements.forEach(s => {
      if (EGGSHELL_RE.test(s.name)) return;
      if (!hasAlias(s)) return;
      const displayName = s.displayName || s.name;
      if (!rows.has(displayName)) {
        rows.set(displayName, { displayName, weightsByPresetId: {} });
      }
      rows.get(displayName).weightsByPresetId[view.preset.id] = s.scaledWeight;
    });
  });
  return Array.from(rows.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
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
