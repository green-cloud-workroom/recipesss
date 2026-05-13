// main.js — 앱 부트스트랩
//
// 순서:
//   1. localStorage에서 v2 데이터 로드 시도
//   2. 없으면 v1 데이터 로드 → 마이그레이션 → v2 저장
//   3. 둘 다 없으면 빈 state
//   4. store 생성
//   5. 각 UI 모듈 초기화

import { loadV2, loadV1, saveState } from "./repository.js?v=20260513-result-global-supp-only-1";
import { migrateV1toV2, normalizeV2State } from "./migrations.js?v=20260513-result-global-supp-only-1";
import { createEmptyState } from "./schema.js?v=20260513-result-global-supp-only-1";
import { createStore } from "./store.js?v=20260513-result-global-supp-only-1";
import { reducers } from "./actions.js?v=20260513-result-global-supp-only-1";
import { initShell, toast } from "./ui-shell.js?v=20260513-result-global-supp-only-1";
import { initRecipeTab } from "./ui-tab-recipe.js?v=20260513-result-global-supp-only-1";
import { initPriceTab } from "./ui-tab-price.js?v=20260513-result-global-supp-only-1";
import { initResultTab } from "./ui-tab-result.js?v=20260513-result-global-supp-only-1";
import { initOrderTab } from "./ui-tab-order.js?v=20260513-result-global-supp-only-1";
import { initPreviewTab } from "./ui-tab-preview.js?v=20260513-result-global-supp-only-1";

function loadInitialState() {
  // 1. v2 우선
  const v2 = loadV2();
  if (v2) {
    console.log("[main] v2 state 로드됨");
    const normalized = normalizeV2State(v2);
    if (normalized.changed) {
      saveState(normalized.state);
      console.log("[main] v2 state 정리 완료");
    }
    return { state: normalized.state, migrated: false };
  }

  // 2. v1 마이그레이션 시도
  const v1 = loadV1();
  if (v1 && v1.recipe) {
    console.log("[main] v1 → v2 마이그레이션 시도");
    const migrated = migrateV1toV2(v1);
    saveState(migrated); // 즉시 v2 키에 저장 (v1 키는 안 건드림)
    console.log("[main] 마이그레이션 완료:", {
      products: Object.keys(migrated.products).length,
      ingredients: Object.keys(migrated.ingredients).length,
      prices: Object.keys(migrated.prices).length,
      presets: Object.keys(migrated.presets).length
    });
    return { state: migrated, migrated: true };
  }

  // 3. 빈 상태
  console.log("[main] 신규 state");
  return { state: createEmptyState(), migrated: false };
}

function boot() {
  const { state, migrated } = loadInitialState();
  const store = createStore(reducers, state);

  // 디버그용: window.__store로 접근 가능
  if (typeof window !== "undefined") window.__store = store;

  initShell(store);
  initRecipeTab(store);
  initPriceTab(store);
  initResultTab(store);
  initOrderTab(store);
  initPreviewTab(store);

  if (migrated) {
    setTimeout(() => toast("기존 데이터가 v2로 마이그레이션되었습니다", 3500), 200);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

