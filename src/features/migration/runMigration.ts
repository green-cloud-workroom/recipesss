// 마이그레이션 쓰기 어댑터 (SPEC §11.2, DL-031). buildMigrationPlan 결과를
// fant-e5ae5 Firestore 에 batch write. 얇은 어댑터 — 변환 로직은 순수함수
// (migrateV2toV3 / buildMigrationPlan)에 있고 그쪽이 테스트로 검증됨.

import {
  collection,
  doc,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../../firebase'
import type { FirestoreWrite } from './buildMigrationPlan'

// Firestore writeBatch 는 500 ops 제한. 여유 두고 청크.
const BATCH_LIMIT = 450

// 플랜을 batch 로 commit. 청크 단위로 원자적. 쓰인 문서 수 반환.
export async function runMigrationWrites(
  writes: FirestoreWrite[],
): Promise<number> {
  let written = 0
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)
    for (const w of chunk) {
      batch.set(doc(db, w.collectionPath, w.docId), w.data)
    }
    await batch.commit()
    written += chunk.length
  }
  return written
}

export type ExistingCounts = {
  recipeDrafts: number
  ingredients: number
  presets: number
}

// dry-run 경고용: 대상 컬렉션에 이미 있는 문서 수 (덮어쓰기 여부 판단).
// getCountFromServer 는 문서 본문을 읽지 않아 가볍다.
export async function countExistingDocs(uid: string): Promise<ExistingCounts> {
  const [d, i, p] = await Promise.all([
    getCountFromServer(collection(db, `recipeDrafts/${uid}/items`)),
    getCountFromServer(collection(db, `recipesssIngredients/${uid}/items`)),
    getCountFromServer(collection(db, `recipesssPresets/${uid}/items`)),
  ])
  return {
    recipeDrafts: d.data().count,
    ingredients: i.data().count,
    presets: p.data().count,
  }
}
