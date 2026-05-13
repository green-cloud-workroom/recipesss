// cloud-sync.js - Firestore backed shared state.

import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  FIREBASE_COLLECTION,
  FIREBASE_DOCUMENT_ID,
  isFirebaseConfigured
} from "./firebase-config.js?v=20260513-alias-sort-1";
import { getFirebaseApp } from "./firebase-core.js?v=20260513-alias-sort-1";

const CLIENT_ID_KEY = "recipe_cost_v2_cloud_client_id";
const SAVE_DEBOUNCE_MS = 900;

let db = null;
let stateRef = null;
let clientId = null;
let applyingRemote = false;
let saveTimer = null;
let latestRemoteSavedAt = 0;

export async function loadCloudState() {
  if (!isFirebaseConfigured) return { status: "not-configured", state: null };

  try {
    const snapshot = await getDoc(getStateDoc());
    if (!snapshot.exists()) return { status: "empty", state: null };
    const data = snapshot.data() || {};
    latestRemoteSavedAt = data.savedAt || 0;
    return { status: "loaded", state: data.state || null, savedAt: latestRemoteSavedAt };
  } catch (error) {
    console.warn("[cloud] load failed", error);
    return { status: "error", state: null, error };
  }
}

export function initCloudSync(store, { shouldSeedCloud = false, toast = () => {} } = {}) {
  if (!isFirebaseConfigured) return;

  if (shouldSeedCloud) {
    scheduleCloudSave(store.getState(), toast, 80);
  }

  const unsubscribe = onSnapshot(
    getStateDoc(),
    snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() || {};
      if (!data.state) return;
      if (data.clientId === getClientId()) return;
      if ((data.savedAt || 0) <= latestRemoteSavedAt) return;

      latestRemoteSavedAt = data.savedAt || Date.now();
      applyingRemote = true;
      store.setState(mergeRemoteState(store.getState(), data.state), {
        save: true,
        action: { type: "REMOTE_SYNC" },
        emitChange: true
      });
      applyingRemote = false;
      toast("온라인 데이터가 반영되었습니다.", 1800);
    },
    error => {
      console.warn("[cloud] listen failed", error);
      toast("Firebase 연결 또는 규칙을 확인해 주세요.", 3500);
    }
  );

  store.subscribe("change", ({ state, action }) => {
    if (applyingRemote) return;
    if (action?.type === "REMOTE_SYNC") return;
    scheduleCloudSave(state, toast);
  });

  window.addEventListener("beforeunload", unsubscribe, { once: true });
}

function getStateDoc() {
  if (!db) db = getFirestore(getFirebaseApp());
  if (!stateRef) stateRef = doc(db, FIREBASE_COLLECTION, FIREBASE_DOCUMENT_ID);
  return stateRef;
}

function getClientId() {
  if (clientId) return clientId;
  clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

function scheduleCloudSave(state, toast, delay = SAVE_DEBOUNCE_MS) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveCloudState(state, toast), delay);
}

async function saveCloudState(state, toast) {
  try {
    const savedAt = Date.now();
    await setDoc(getStateDoc(), {
      state: {
        ...state,
        meta: {
          ...(state.meta || {}),
          savedAt
        }
      },
      savedAt,
      clientId: getClientId()
    });
    latestRemoteSavedAt = savedAt;
  } catch (error) {
    console.warn("[cloud] save failed", error);
    toast("온라인 저장에 실패했습니다. Firebase 규칙을 확인해 주세요.", 3500);
  }
}

function mergeRemoteState(current, remote) {
  return {
    ...remote,
    ui: {
      ...(remote.ui || {}),
      activeTab: current.ui?.activeTab || remote.ui?.activeTab || "recipe"
    }
  };
}
