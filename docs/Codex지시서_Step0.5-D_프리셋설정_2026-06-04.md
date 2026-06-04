# Codex 지시서 — Step 0.5-D: 프리셋 설정 페이지 (`/presets`)

> 작성: Claude (아키텍트) · 2026-06-04 · 구현: Codex
> 정본: **SPEC.md §5.5, §8.2, §8.3**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 단계 0.5 데이터·기능 이식의 **프리셋 설정** 화면.
- **이 프로젝트의 첫 쓰기(mutation) 화면**이다. 여기서 확립하는 mutation 패턴(useMutation + 캐시 invalidate + Zod/react-hook-form 폼)은 이후 모든 write 화면(원료 마스터 등)의 기준이 된다. 신중히, 패턴을 깔끔하게.
- 데이터: `recipesssPresets/{uid}/items/*` (마이그레이션으로 100개 존재). `Preset` 타입은 `src/types/recipe.ts`에 있음 — **그대로 사용**.
- 프리셋은 레시피에 종속(`preset.draftId` → `recipeDrafts` id). `/recipes`(0.5-C)와 같은 `recipeDrafts` 를 읽는다.

## 1. 목표·범위

### IN (이번에 구현)

1. 2단 레이아웃: **좌측 레시피 목록**(선택 가능) + **우측 선택 레시피의 프리셋 목록**
2. 프리셋 **read**: `recipesssPresets/{uid}/items` (Query 키 `['recipesssPresets']`), 선택 레시피로 필터, `sortOrder` 정렬
3. 프리셋 **추가**: 모달 폼(code·목표량·라벨·생산단위 투입량) → `setDoc`
4. 프리셋 **편집**: 같은 폼 재사용 → `setDoc`(upsert)
5. 프리셋 **삭제**: 확인 후 `deleteDoc`
6. mutation 성공 시 `['recipesssPresets']` invalidate → 목록 자동 갱신

### OUT (이번에 만들지 말 것 — 후속)

- ❌ **드래그&드롭 정렬** (`@dnd-kit` — 후속). 이번엔 `sortOrder` = 추가순(기존 max + 1)
- ❌ **코드 자동 부여 로직** (v2 `preset-codes.js` 의 prefix별 자동) — 이번엔 **사용자가 코드 직접 입력**. SPEC §5.5 "자동 부여"는 후속 단계에 명시.
- ❌ 발주 연동(§5.6), 레시피 CRUD(§5.3 후속)

## 2. 먼저 읽을 것

- `SPEC.md` §5.5(프리셋 설정), §8.2(Query 키), §8.3(Zod 폼 패턴)
- `src/types/recipe.ts` — `Preset` 타입 (id·draftId·code·targetWeight·label·unitIngredientId·inputAmount·inputUnitLabel·sortOrder·createdAt)
- `src/features/recipes/recipeQueries.ts` — `useRecipeDrafts` (좌측 레시피 목록 재사용)
- `src/features/recipes/filterDrafts.ts` — 순수 함수 + 테스트 분리 패턴 참고
- `src/pages/RecipesPage.tsx` — 페이지/상태/클래스 패턴
- `src/components/common/Modal.tsx` — 추가·편집 모달
- `src/lib/ui.ts` — 클래스 상수

## 3. 구현 단위

### 3-0. (사전) 의존성 설치

```bash
npm install @hookform/resolvers
```
SPEC §8.3 `zodResolver` 용. `zod`·`react-hook-form` 은 이미 설치됨. package.json/package-lock 변경은 커밋에 포함.

### 3-1. `src/features/presets/presetQueries.ts` (신규) — read

```ts
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

export async function fetchPresets(uid: string): Promise<Preset[]> {
  const snap = await getDocs(collection(db, `recipesssPresets/${uid}/items`))
  return snap.docs
    .map((d) => ({ ...(d.data() as Preset), id: d.id }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function usePresets(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipesssPresets'], // SPEC §8.2 (1인 사용, uid 미포함 — DL-015)
    queryFn: () => fetchPresets(uid as string),
    enabled: !!uid,
  })
}
```

### 3-2. `src/features/presets/presetSelectors.ts` (신규) — 순수 함수 + 테스트

```ts
import type { Preset } from '../../types/recipe'

// 선택 레시피의 프리셋만, sortOrder 정렬
export function selectPresetsByDraft(presets: Preset[], draftId: string): Preset[] {
  return presets
    .filter((p) => p.draftId === draftId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// 새 프리셋의 sortOrder = 같은 draft 내 max + 1 (없으면 0)
export function nextSortOrder(presets: Preset[], draftId: string): number {
  const inDraft = presets.filter((p) => p.draftId === draftId)
  if (inDraft.length === 0) return 0
  return Math.max(...inDraft.map((p) => p.sortOrder)) + 1
}
```

**테스트** `presetSelectors.test.ts`: draft 필터+정렬, 빈 draft, nextSortOrder(빈/기존), 다른 draft 섞임.

### 3-3. `src/features/presets/presetMutations.ts` (신규) — write 패턴 ★

> **이 파일이 mutation 표준이다.** upsert(추가+편집 통합) + delete. 성공 시 invalidate.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

function presetRef(uid: string, presetId: string) {
  return doc(db, `recipesssPresets/${uid}/items`, presetId)
}

export function useUpsertPreset(uid: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (preset: Preset) => {
      if (!uid) throw new Error('uid 없음')
      await setDoc(presetRef(uid, preset.id), preset) // 전체 덮어쓰기 (id 결정적)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipesssPresets'] }),
  })
}

export function useDeletePreset(uid: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (presetId: string) => {
      if (!uid) throw new Error('uid 없음')
      await deleteDoc(presetRef(uid, presetId))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipesssPresets'] }),
  })
}
```

### 3-4. `src/features/presets/presetForm.ts` (신규) — Zod 스키마

```ts
import { z } from 'zod'

export const presetFormSchema = z.object({
  code: z.string().min(1, '코드를 입력하세요'),
  targetWeight: z.coerce.number().positive('목표량은 0보다 커야 합니다'),
  label: z.string(),                       // 선택, 빈 문자열 허용
  inputAmount: z.coerce.number().min(0),   // 생산단위 투입량
  inputUnitLabel: z.string(),              // 'kg' 등
})

export type PresetFormValues = z.infer<typeof presetFormSchema>
```

### 3-5. 신규 프리셋 id 생성 규칙

- 신규 추가 시 id = `` `preset_${random8}` `` (기존 형식 유지). `random8` = 소문자+숫자 8자.
  - `crypto.randomUUID().replace(/-/g, '').slice(0, 8)` 사용 (브라우저 표준).
- 편집 시 기존 id 유지.
- 신규 Preset 조립:
  - `draftId`: 선택된 레시피 id
  - `unitIngredientId`: 선택된 레시피의 `unitIngredientId` 를 그대로 (폼에서 안 받음 — 단순화)
  - `sortOrder`: `nextSortOrder(presets, draftId)`
  - `createdAt`: `Date.now()`
  - 나머지(code·targetWeight·label·inputAmount·inputUnitLabel): 폼 값

### 3-6. `src/pages/PresetsPage.tsx` (신규)

- `useAuthStore` uid
- 좌측: `useRecipeDrafts(uid)` → 레시피 리스트(클릭 선택). 선택 상태 `useState<string | null>(selectedDraftId)`
- 우측: `usePresets(uid)` → `selectPresetsByDraft(presets, selectedDraftId)` 표시
  - 컬럼: 코드 / 목표량(g) / 라벨 / 생산단위 투입량(`inputAmount inputUnitLabel`) / 액션(편집·삭제)
- "프리셋 추가" 버튼 → `Modal` + react-hook-form(`zodResolver(presetFormSchema)`) → `useUpsertPreset`
- 편집: 행 액션 → 같은 모달에 기존 값 채워서 → `useUpsertPreset`
- 삭제: 확인(`window.confirm` 또는 Modal) → `useDeletePreset`
- 상태: 레시피 미선택 시 안내, 프리셋 없음 빈 상태, 로딩/에러
- mutation 중 버튼 disabled(`isPending`), 실패 시 에러 표시

### 3-7. `src/routes/appRouter.tsx` (수정)

```tsx
import { PresetsPage } from '../pages/PresetsPage'
// ...
{ path: '/presets', element: <PresetsPage /> },  // PlaceholderPage 교체
```

## 4. 제약

- `tsconfig.app.json`: `verbatimModuleSyntax`(`import type`), `erasableSyntaxOnly`(**enum 금지**), `noUncheckedIndexedAccess`
- 상대경로 import, alias 없음
- **`recipesssPresets/{uid}/items` 외 컬렉션 write 금지.** 레시피(`recipeDrafts`)는 읽기만.
- `setDoc` 은 전체 덮어쓰기 — 편집 시 기존 필드 누락 없게 **전체 Preset 객체**를 넘길 것 (부분 update 아님)
- `undefined` 필드를 Preset 에 넣지 말 것 (Firestore 거부) — label/inputUnitLabel 은 빈 문자열로
- 새 라이브러리는 `@hookform/resolvers` 만. 그 외 추가 금지

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과
- `npm run dev` → `/presets` → 레시피 선택 → 프리셋 목록 표시 → 추가/편집/삭제가 Firestore 반영 + 목록 자동 갱신(invalidate)
- 마이그레이션된 프리셋이 레시피별로 맞게 보이는지 (예: 래빗 dog → P0~P4)

## 6. 보고 양식

- 변경/신규 파일, 추가된 의존성
- 순수 함수 테스트 케이스 수
- mutation 패턴에서 내린 결정(낙관적 업데이트 안 함 / invalidate 방식 등)
- 빠뜨린 것·애매했던 결정 surface
- side effect 가능성 (특히 write 경로)

---

## 아키텍트 노트 (Claude → Codex)

- **이게 첫 write 화면이다.** mutation 패턴(`presetMutations.ts`)을 깔끔하게 — 낙관적 업데이트(optimistic)는 **하지 말 것**. 단순 invalidate 로 재조회가 1인 사용엔 충분하고 버그 여지가 적다.
- `setDoc` upsert 로 추가/편집 통합한 이유: 같은 코드 경로 → 테스트·리뷰 쉬움. 부분 `updateDoc` 은 필드 누락 위험이라 피한다.
- 프리셋 id 는 마이그레이션 형식(`preset_xxxxxxxx`)을 유지. firestore auto-id(`doc().id`) 를 쓰면 형식이 깨지니 위 3-5 규칙대로 생성.
- `selectPresetsByDraft`/`nextSortOrder` 를 순수 함수로 뽑은 이유: 0.5-A/B/C 와 동일 — UI 없이 회귀 테스트. 정렬·코드부여를 후속에 붙일 때 여기서 확장.
- 코드 자동 부여(SPEC §5.5)를 미룬 건 의도적이다. v2 `preset-codes.js` 의 prefix 로직은 별도 분석이 필요해 0.5-D 범위를 흐린다. 이번엔 수동 입력, 다음 지시서에서 자동 부여를 순수 함수로 설계해 붙인다.
- `targetWeight` 단위는 g 고정(SPEC §4.7). `inputAmount`/`inputUnitLabel` 은 생산단위 투입량(예: 토끼고기 3kg) — 0.5-D 출력1 표시와 같은 값이다.
