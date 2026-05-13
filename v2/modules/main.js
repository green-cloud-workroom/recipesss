// main.js - application bootstrap.

import { loadV2, loadV1, saveState } from "./repository.js?v=20260513-firebase-auth-1";
import { migrateV1toV2, normalizeV2State } from "./migrations.js?v=20260513-firebase-auth-1";
import { createEmptyState } from "./schema.js?v=20260513-firebase-auth-1";
import { createStore } from "./store.js?v=20260513-firebase-auth-1";
import { reducers } from "./actions.js?v=20260513-firebase-auth-1";
import { initShell, toast } from "./ui-shell.js?v=20260513-firebase-auth-1";
import { initRecipeTab } from "./ui-tab-recipe.js?v=20260513-firebase-auth-1";
import { initPriceTab } from "./ui-tab-price.js?v=20260513-firebase-auth-1";
import { initResultTab } from "./ui-tab-result.js?v=20260513-firebase-auth-1";
import { initOrderTab } from "./ui-tab-order.js?v=20260513-firebase-auth-1";
import { initPreviewTab } from "./ui-tab-preview.js?v=20260513-firebase-auth-1";
import { initCloudSync, loadCloudState } from "./cloud-sync.js?v=20260513-firebase-auth-1";
import { initAuthControls, requireAuth } from "./auth-gate.js?v=20260513-firebase-auth-1";

function loadInitialState() {
  const v2 = loadV2();
  if (v2) {
    const normalized = normalizeV2State(v2);
    if (normalized.changed) saveState(normalized.state);
    return { state: normalized.state, migrated: false };
  }

  const v1 = loadV1();
  if (v1 && v1.recipe) {
    const migrated = migrateV1toV2(v1);
    saveState(migrated);
    return { state: migrated, migrated: true };
  }

  return { state: createEmptyState(), migrated: false };
}

async function boot() {
  await requireAuth();

  const local = loadInitialState();
  const cloud = await loadCloudState();
  let initial = local.state;
  let loadedFromCloud = false;

  if (cloud.state) {
    const normalized = normalizeV2State(cloud.state);
    initial = {
      ...normalized.state,
      ui: {
        ...(normalized.state.ui || {}),
        activeTab: local.state.ui?.activeTab || "recipe"
      }
    };
    saveState(initial);
    loadedFromCloud = true;
  }

  const store = createStore(reducers, initial);
  if (typeof window !== "undefined") window.__store = store;

  initShell(store);
  initAuthControls();
  initRecipeTab(store);
  initPriceTab(store);
  initResultTab(store);
  initOrderTab(store);
  initPreviewTab(store);

  initCloudSync(store, {
    shouldSeedCloud: !loadedFromCloud && cloud.status === "empty" && hasMeaningfulData(initial),
    toast
  });

  if (local.migrated) {
    setTimeout(() => toast("기존 데이터가 v2로 마이그레이션되었습니다.", 3500), 200);
  }
  if (loadedFromCloud) {
    setTimeout(() => toast("온라인 데이터를 불러왔습니다.", 2500), 500);
  }
}

function hasMeaningfulData(state) {
  return Boolean(
    Object.keys(state.products || {}).length ||
    Object.keys(state.ingredients || {}).length ||
    Object.keys(state.presets || {}).length
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
