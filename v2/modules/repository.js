// repository.js — localStorage 어댑터
//
// 책임: state를 localStorage에 안전하게 저장/로드, 스냅샷 자동 백업
// 의존: schema.js

import { SCHEMA_VERSION, createEmptyState, makeId } from "./schema.js?v=20260513-alias-style-1";

export const STORAGE_KEY = "recipe_cost_v2_state";
export const SNAPSHOT_LIST_KEY = "recipe_cost_v2_snapshots";
const MAX_SNAPSHOTS = 5;

// v1 키들 (마이그레이션 시 읽기 전용)
export const LEGACY_KEYS = {
  recipe: "recipe_cost_utf8_v1",
  order: "recipe_cost_order_v1"
};

// 스키마가 진화할 때 누락된 필드를 자동으로 채운다.
function ensureV2Shape(state) {
  const empty = createEmptyState();
  if (!state) return empty;
  return {
    ...empty,
    ...state,
    meta: { ...empty.meta, ...(state.meta || {}) },
    ui: { ...empty.ui, ...(state.ui || {}) }
  };
}

export function loadV2() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
    return ensureV2Shape(parsed);
  } catch (e) {
    console.warn("v2 로드 실패:", e);
    return null;
  }
}

export function loadV1() {
  try {
    const recipeRaw = localStorage.getItem(LEGACY_KEYS.recipe);
    const orderRaw = localStorage.getItem(LEGACY_KEYS.order);
    if (!recipeRaw) return null;
    return {
      recipe: JSON.parse(recipeRaw),
      order: orderRaw ? JSON.parse(orderRaw) : null
    };
  } catch (e) {
    console.warn("v1 로드 실패:", e);
    return null;
  }
}

export function saveState(state) {
  try {
    const payload = { ...state, meta: { ...state.meta, savedAt: Date.now() } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error("저장 실패:", e);
    return false;
  }
}

// 스냅샷: 위험한 작업 직전에 호출
export function pushSnapshot(state, reason = "") {
  try {
    const id = makeId("snapshot");
    const key = `${SNAPSHOT_LIST_KEY}__${id}`;
    localStorage.setItem(key, JSON.stringify(state));

    const list = getSnapshotList();
    list.unshift({ id, key, reason, createdAt: Date.now() });

    // 오래된 것부터 제거
    while (list.length > MAX_SNAPSHOTS) {
      const removed = list.pop();
      localStorage.removeItem(removed.key);
    }
    localStorage.setItem(SNAPSHOT_LIST_KEY, JSON.stringify(list));
    return id;
  } catch (e) {
    console.warn("스냅샷 실패:", e);
    return null;
  }
}

export function getSnapshotList() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadSnapshot(snapshotId) {
  const list = getSnapshotList();
  const entry = list.find(s => s.id === snapshotId);
  if (!entry) return null;
  try {
    const raw = localStorage.getItem(entry.key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// JSON 백업 다운로드
export function downloadStateAsFile(state) {
  const today = new Date().toISOString().slice(0, 10);
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recipe-state-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

