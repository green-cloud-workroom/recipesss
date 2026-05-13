// ui-shell.js — 앱 셸: 탭 전환, 헤더 버튼, 토스트, 모달 기본
//
// 책임: 전역 UI 요소 (탭 바, 헤더, 토스트). 각 탭 컨텐츠는 별도 모듈.
// 의존: store, repository

import { downloadStateAsFile } from "./repository.js?v=20260513-output-tables-1";
import { readRecipeExcelFile } from "./excel-import.js?v=20260513-output-tables-1";

const TABS = ["recipe", "price", "result", "order", "preview"];

export function initShell(store) {
  // 탭 전환
  const tabBar = document.getElementById("tabBar");
  tabBar.addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]")?.dataset.tab;
    if (tab) store.dispatch({ type: "SET_ACTIVE_TAB", tab });
  });

  // 활성 탭 표시 갱신 (구독)
  function applyActiveTab() {
    const active = store.getState().ui.activeTab || "recipe";
    TABS.forEach(name => {
      const panel = document.getElementById(`tab-${name}`);
      if (panel) panel.classList.toggle("hidden", name !== active);
    });
    tabBar.querySelectorAll("[data-tab]").forEach(el => {
      el.classList.toggle("active", el.dataset.tab === active);
    });
  }
  store.subscribe("SET_ACTIVE_TAB", applyActiveTab);
  applyActiveTab();

  // 헤더 버튼
  document.getElementById("downloadBtn")?.addEventListener("click", () => {
    downloadStateAsFile(store.getState());
    toast("백업 파일 다운로드 시작");
  });

  const importInput = document.getElementById("excelImportInput");
  document.getElementById("importBtn")?.addEventListener("click", () => {
    importInput?.click();
  });
  importInput?.addEventListener("change", event => handleExcelImport(store, event));
}

async function handleExcelImport(store, event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const parsed = await readRecipeExcelFile(file);
    const products = parsed.products || [];
    if (!products.length) {
      toast("가져올 레시피가 없습니다");
      return;
    }

    const existing = new Set(
      Object.values(store.getState().products)
        .map(product => `${product.species || ""}|${product.name.trim()}`)
    );
    const overwriteCount = products.filter(product => existing.has(`${product.species || ""}|${product.name.trim()}`)).length;
    const addCount = products.length - overwriteCount;
    const summary = [
      `엑셀에서 ${products.length}개 제품을 찾았습니다.`,
      `새로 추가: ${addCount}개`,
      `덮어쓰기: ${overwriteCount}개`,
      "",
      "같은 종과 이름의 기존 레시피는 엑셀 내용으로 교체됩니다."
    ].join("\n");

    if (!confirm(summary + "\n\n진행할까요?")) return;
    store.dispatch({ type: "IMPORT_PRODUCTS", products });
    toast(`엑셀 가져오기 완료: ${addCount}개 추가, ${overwriteCount}개 덮어쓰기`, 3000);
  } catch (error) {
    alert("엑셀 가져오기에 실패했습니다: " + error.message);
  }
}

// 토스트
let toastTimer = null;
export function toast(message, duration = 2000) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

