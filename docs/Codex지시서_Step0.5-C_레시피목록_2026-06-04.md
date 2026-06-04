# Codex 지시서 — Step 0.5-C: 레시피 목록 페이지 (`/recipes`)

> 작성: Claude (아키텍트) · 2026-06-04 · 구현: Codex
> 정본: **SPEC.md §5.3, §8.2**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 단계 0.5 "데이터·기능 이식"의 레시피 목록 화면 **첫 골격**.
- `recipeDrafts/{uid}/items/*` 를 읽어 목록으로 보여준다. (마이그레이션으로 데이터가 들어옴 — 0.5-B)
- 현재 `/recipes` 는 `PlaceholderPage`. 이걸 실제 `RecipesPage` 로 교체.
- 데이터가 아직 비어 있어도(마이그레이션 전) **빈 목록 UI가 정상 동작**해야 한다 — Firestore 규칙/마이그레이션 블로커와 독립적으로 구현 가능.

## 1. 목표·범위

### 이번에 구현 (IN)

1. `recipeDrafts/{uid}/items/*` 읽기 (TanStack Query, 키 `['recipeDrafts']`)
2. 목록 렌더 — `sortOrder` 오름차순. 표 형태(기존 클래스 상수 사용).
3. 상단 필터: **상태**(전체/임시 `draft`/비활성 `inactive`), **종**(전체/고양이 `cat`/강아지 `dog`/미지정 `null`), **검색**(이름 부분일치)
4. 좌측 또는 상단에 **종별 카운트** (cat/dog/미지정 각 몇 개)
5. 행 클릭 → `/recipes/draft/:draftId` 로 이동 (편집 화면은 아직 PlaceholderPage — 이동만)
6. 로딩 / 에러 / 빈 목록 상태 표시

### 이번에 구현하지 않음 (OUT — 후속 단계, 절대 만들지 말 것)

- ❌ "생산관리로 푸시" (단계 3 — DL-025 변환)
- ❌ 드래그&드롭 정렬 (후속 — `@dnd-kit`)
- ❌ 복제 / 삭제 / 상태 토글 (후속)
- ❌ 신규 레시피 편집 폼 (단계 1·3)

> 범위를 넘기지 말 것. 위 OUT 항목 자리에 버튼만 미리 두지도 말 것 (혼란 유발).

## 2. 먼저 읽을 것

- `SPEC.md` §5.3 (레시피 목록), §8.2 (Query 키 정책)
- `src/types/recipe.ts` — `RecipeDraft`, `Species` 타입 (이미 존재, **그대로 사용**)
- `src/pages/SettingsPage.tsx` — uid 획득(`useAuthStore`), Firestore 접근, 클래스 상수 사용 패턴 참고
- `src/features/migration/runMigration.ts` — `collection`/`getDocs` 사용 예시
- `src/lib/ui.ts` — `CARD_CLS`, `INPUT_CLS`, `SECONDARY_BTN_CLS`, `EMPTY_STATE_CLS`
- `src/routes/appRouter.tsx` — `/recipes` 라우트 교체 대상

## 3. 구현 단위

### 3-1. `src/features/recipes/recipeQueries.ts` (신규)

```ts
import { collection, getDocs } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
import { db } from '../../firebase'
import type { RecipeDraft } from '../../types/recipe'

// recipeDrafts/{uid}/items/* 읽어 sortOrder 오름차순 RecipeDraft[] 반환.
export async function fetchRecipeDrafts(uid: string): Promise<RecipeDraft[]> {
  const snap = await getDocs(collection(db, `recipeDrafts/${uid}/items`))
  const drafts = snap.docs.map((d) => d.data() as RecipeDraft)
  return drafts.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function useRecipeDrafts(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipeDrafts'], // SPEC §8.2 (uid 자동 포함 정책)
    queryFn: () => fetchRecipeDrafts(uid as string),
    enabled: !!uid,
  })
}
```

### 3-2. `src/features/recipes/filterDrafts.ts` (신규) — 순수 함수 + 테스트

> 필터 로직은 **순수 함수로 분리**하고 Vitest 로 테스트한다 (UI 와 분리, 0.5-A/B 패턴).

```ts
import type { RecipeDraft, Species } from '../../types/recipe'

export type DraftFilter = {
  status: 'all' | 'draft' | 'inactive'
  species: 'all' | Species  // 'all' | 'cat' | 'dog' | null
  search: string
}

export function filterDrafts(drafts: RecipeDraft[], filter: DraftFilter): RecipeDraft[] {
  const q = filter.search.trim().toLowerCase()
  return drafts.filter((d) => {
    if (filter.status !== 'all' && d.status !== filter.status) return false
    if (filter.species !== 'all' && d.species !== filter.species) return false
    if (q && !d.name.toLowerCase().includes(q)) return false
    return true
  })
}

// 종별 카운트 (필터 전 전체 기준)
export function countBySpecies(drafts: RecipeDraft[]): { cat: number; dog: number; none: number } {
  const c = { cat: 0, dog: 0, none: 0 }
  for (const d of drafts) {
    if (d.species === 'cat') c.cat += 1
    else if (d.species === 'dog') c.dog += 1
    else c.none += 1
  }
  return c
}
```

**테스트** `src/features/recipes/filterDrafts.test.ts`:
- 상태 필터 (draft/inactive/all)
- 종 필터 (cat/dog/null/all) — `species: null` 케이스 주의
- 검색 (대소문자 무시, 부분일치, 공백 trim)
- 복합 필터 (상태+종+검색 동시)
- `countBySpecies` 정확성
- 빈 입력

### 3-3. `src/pages/RecipesPage.tsx` (신규)

- `useAuthStore((s) => s.user?.uid)` 로 uid
- `useRecipeDrafts(uid)` → `{ data, isLoading, isError }`
- `useState<DraftFilter>` 로 필터 상태. 기본 `{ status: 'all', species: 'all', search: '' }`
- `filterDrafts(data ?? [], filter)` 로 표시 목록, `countBySpecies(data ?? [])` 로 카운트
- 표 컬럼: 이름 / 종(고양이·강아지·미지정) / 상태(임시·비활성) / 구성 원료 수(`composition.length`)
- 행 클릭 → `useNavigate()` 로 `/recipes/draft/${draft.id}`
- 상태 표시:
  - `isLoading` → "불러오는 중..."
  - `isError` → 빨간 박스 (규칙 미설정이면 permission-denied 가능 — 메시지 그대로 노출)
  - 빈 목록 → `EMPTY_STATE_CLS` "레시피가 없습니다. 백업·복원에서 마이그레이션하세요."
- 종 라벨 변환은 `SettingsPage`/`ui-tab-preview` 의 `(고양이)`/`(강아지)` 관례 따름
- 클래스: `CARD_CLS`, `INPUT_CLS`(검색), 상태/종 필터는 `<select>` + `INPUT_CLS` 또는 버튼 그룹

### 3-4. `src/routes/appRouter.tsx` (수정)

```tsx
import { RecipesPage } from '../pages/RecipesPage'
// ...
{ path: '/recipes', element: <RecipesPage /> },   // PlaceholderPage 교체
```

## 4. 제약 (반드시 지킬 것)

- `tsconfig.app.json`: `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(**enum 금지** — union 사용), `noUncheckedIndexedAccess`(인덱스 접근 undefined 처리)
- path alias 없음 — **상대경로** import
- `recipeDrafts/{uid}/items` 외 다른 컬렉션 건드리지 말 것. **읽기 전용** (이번엔 write 없음)
- 새 라이브러리 추가 금지 (TanStack Query·firebase 이미 있음)
- 기존 파일 중 `appRouter.tsx` 외에는 수정 금지

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과
- `npm run dev` → 로그인 → 좌측 "레시피 목록" → 빈 목록 또는 데이터 표시, 필터 동작, 행 클릭 시 편집 경로 이동

## 6. 보고 양식 (구현 후)

- 변경/신규 파일 목록
- 필터 로직 테스트 케이스 수
- 빠뜨린 것 / 애매했던 결정 (있으면 surface)
- side effect 가능성

---

## 아키텍트 노트 (Claude → Codex)

- 이 화면은 **읽기 전용 목록**이다. mutation(푸시·삭제·정렬)은 의도적으로 다음 단계로 미뤘다. 욕심내지 말 것.
- `filterDrafts`/`countBySpecies` 를 순수 함수로 뽑은 이유: UI 없이 회귀 테스트 가능하게 하려는 것. 0.5-A(`migrateV2toV3`)·0.5-B(`buildMigrationPlan`)와 같은 패턴.
- `species: null`(미지정 6건 존재) 케이스를 필터·카운트·표시 모두에서 빠뜨리지 말 것. 실제 백업에 있다.
- Query 키는 SPEC §8.2 대로 `['recipeDrafts']` 단일. uid 가 바뀌면(재로그인) invalidate 필요하지만 1인 사용(DL-015)이라 이번엔 신경 안 써도 된다.
