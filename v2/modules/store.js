// store.js — 상태 관리 코어
//
// 책임: 단일 state 보관, dispatch로만 변경, 변경 후 구독자에게 통지
// 의존: schema.js, repository.js
//
// 패턴: Redux-like (dispatch + reducer + subscribe) but minimal.
//   - dispatch(action) → reducer → newState → 저장 → emit
//   - reducer는 (state, action) => newState, 순수 함수
//   - reducer 등록은 외부에서 (actions.js가 register)
//   - 이벤트는 action.type별 + 'change' (전역)
//   - 위험한 액션 직전엔 자동 스냅샷

import { createEmptyState } from "./schema.js?v=20260513-alias-style-1";
import { saveState, pushSnapshot } from "./repository.js?v=20260513-alias-style-1";

// 자동 스냅샷 대상 액션 (되돌리기 필요한 위험 작업)
const SNAPSHOT_ACTIONS = new Set([
  "IMPORT_PRODUCTS",
  "REMOVE_PRODUCT",
  "REMOVE_UNUSED_SUPPLEMENT",
  "REMOVE_ALL_UNUSED_SUPPLEMENTS",
  "CLEAR_ALL_PRESETS",
  "RESTORE_SNAPSHOT"
]);

export function createStore(reducers, initialState = null) {
  let state = initialState || createEmptyState();
  const listeners = new Map(); // eventName → Set<callback>

  function getState() {
    return state;
  }

  function setState(newState, { save = true } = {}) {
    state = newState;
    if (save) saveState(state);
  }

  function dispatch(action) {
    if (!action || !action.type) {
      console.warn("dispatch: invalid action", action);
      return;
    }
    const reducer = reducers[action.type];
    if (!reducer) {
      console.warn("dispatch: unknown action type", action.type);
      return;
    }

    // 위험한 액션 직전 스냅샷
    if (SNAPSHOT_ACTIONS.has(action.type)) {
      pushSnapshot(state, action.type);
    }

    const prev = state;
    const next = reducer(state, action);
    if (next === prev) return; // no-op

    state = next;
    saveState(state);

    // 액션 타입별 이벤트 + 전역 'change'
    emit(action.type, { action, state, prev });
    emit("change", { action, state, prev });
  }

  function subscribe(eventName, callback) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(callback);
    return () => listeners.get(eventName)?.delete(callback);
  }

  function emit(eventName, payload) {
    const set = listeners.get(eventName);
    if (!set) return;
    set.forEach(cb => {
      try { cb(payload); }
      catch (e) { console.error(`listener error (${eventName}):`, e); }
    });
  }

  return { getState, setState, dispatch, subscribe };
}

