/**
 * Firebase 초기화 — fant-e5ae5 (DL-017).
 *
 * 운영관리앱·생산관리앱과 같은 프로젝트를 공유한다.
 * 컬렉션 분리:
 *   - recipeDrafts/{uid}/items/*           recipesss 전용 (작성·임시)
 *   - recipes/*                             생산관리앱 공유 (등록)
 *   - recipesssIngredients/{uid}/items/*    recipesss 원료 마스터
 *   - nutrientProfiles/*                    표준 (read-only)
 *   - usdaCache/{fdcId}                     USDA 응답 캐시
 *   - recipesssPresets/{uid}/items/*        발주 프리셋
 *   - recipesssSnapshots/{uid}/items/*      자동 스냅샷
 */

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// 같은 fant-e5ae5 프로젝트 — config는 운영관리앱·생산관리앱과 동일.
// 운영관리앱처럼 환경변수로 분리하는 게 안전. 단계 0-A 시점엔 placeholder.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'fant-e5ae5.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'fant-e5ae5',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'fant-e5ae5.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
