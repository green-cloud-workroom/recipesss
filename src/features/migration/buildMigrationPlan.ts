// 마이그레이션 쓰기 플랜 빌더 (SPEC §11.2, DL-031). 순수 함수 — Firebase 의존 없음.
// MigrationResult 를 Firestore 문서 쓰기 작업 목록으로 펼친다.
// dry-run 미리보기와 실제 batch write(0.5-B 어댑터) 가 같은 플랜을 공유한다.

import type { MigrationResult } from './migrateV2toV3'

export type FirestoreWrite = {
  // 컬렉션 경로 (문서 id 제외). 예: 'recipeDrafts/{uid}/items'
  collectionPath: string
  docId: string
  data: Record<string, unknown>
  kind: 'recipeDraft' | 'ingredient' | 'preset'
}

// SPEC §4.9 컬렉션 경로. uid 는 현재 로그인 사용자(앱 내 실행, DL-031).
export function buildMigrationPlan(
  result: MigrationResult,
  uid: string,
): FirestoreWrite[] {
  if (!uid) throw new Error('buildMigrationPlan: uid is required')

  const writes: FirestoreWrite[] = []

  for (const draft of result.recipeDrafts) {
    writes.push({
      collectionPath: `recipeDrafts/${uid}/items`,
      docId: draft.id,
      data: { ...draft },
      kind: 'recipeDraft',
    })
  }

  for (const ingredient of result.ingredients) {
    writes.push({
      collectionPath: `recipesssIngredients/${uid}/items`,
      docId: ingredient.id,
      data: { ...ingredient },
      kind: 'ingredient',
    })
  }

  for (const preset of result.presets) {
    writes.push({
      collectionPath: `recipesssPresets/${uid}/items`,
      docId: preset.id,
      data: { ...preset },
      kind: 'preset',
    })
  }

  // prices 는 DL-024 인터페이스 미정 → 이번 이전 대상에서 제외 (DL-031).

  return writes
}

// dry-run 미리보기용 요약. 화면에 "드래프트 27 / 원료 91 / 프리셋 100" 표시.
export type MigrationPlanSummary = {
  recipeDrafts: number
  ingredients: number
  presets: number
  total: number
}

export function summarizePlan(writes: FirestoreWrite[]): MigrationPlanSummary {
  const summary: MigrationPlanSummary = {
    recipeDrafts: 0,
    ingredients: 0,
    presets: 0,
    total: writes.length,
  }
  for (const write of writes) {
    if (write.kind === 'recipeDraft') summary.recipeDrafts += 1
    else if (write.kind === 'ingredient') summary.ingredients += 1
    else summary.presets += 1
  }
  return summary
}
