# Codex 지시서 — Step 1-C: 원료 영양값 입력 UI (`/ingredients`)

> 작성: Claude (아키텍트) · 2026-06-05 · 구현: Codex
> 정본: **SPEC.md §5.4, §8.2, §8.3, §4.3**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 단계 1 데이터(1-A, 13 프로파일)·계산엔진(1-B)이 준비됐다. 하지만 **마이그레이션된 원료 91개의 `nutrientProfile`이 전부 빈 객체 `{}`**라, 매트릭스(1-D)가 실데이터로 작동하려면 **원료에 영양값을 채워야** 한다. 1-C가 그 입력 화면이다.
- 데이터: `recipesssIngredients/{uid}/items/{ingredientId}` (마이그레이션으로 91개 존재). `Ingredient` 타입은 `src/types/recipe.ts` — **그대로 사용**.
- 키셋·메타는 1-A 산출물 사용: `NutrientKey`(~45), `src/features/nutrition/nutrientKeys.ts`(`NUTRIENT_META`: label·unit·category·order, `CATEGORY_LABELS`). **수정 금지, 읽기만.**
- 이 화면은 **0.5-D 프리셋 화면과 같은 패턴**(목록 + 편집 + mutation invalidate)이다. `src/pages/PresetsPage.tsx`, `src/features/presets/*`를 참고.

## 1. 목표·범위

### IN (이번에 구현)

1. `/ingredients` 원료 목록 read (kind 그룹: 원료/영양제, 검색 필터)
2. 원료 선택 → **`nutrientProfile` 편집 폼** (카테고리별 ~45 영양소 입력)
3. 저장 → `recipesssIngredients/{uid}/items/{id}` 전체 객체 `setDoc`(nutrientProfile만 교체, 나머지 필드 보존) → `['recipesssIngredients']` invalidate
4. 로딩/에러/빈 상태

### OUT (이번에 만들지 말 것)

- ❌ **USDA 가져오기** (§5.4 추가흐름 1) — 단계 2
- ❌ **수동 원료 추가 / 삭제** (§5.4 추가흐름 2) — 후속. 이번엔 기존 91개 편집만(영양값 채우기가 목적)
- ❌ **드래그&드롭 정렬** — 후속
- ❌ name/kind/displayName/alias/vendor 편집 — 후속(이번은 `nutrientProfile`만; 마이그레이션 값 보존)
- ❌ 영양 매트릭스 (1-D)
- ❌ `null` 결측 저장 — §아키텍트 노트 참고(타입상 불가, 단계 2로)

## 2. 먼저 읽을 것

- `SPEC.md` §5.4(원료 마스터), §8.2(Query 키 — `['recipesssIngredients']`), §8.3(Zod 폼)
- `src/types/recipe.ts` — `Ingredient`(id·name·kind·displayName·aliases·hidden·**nutrientProfile?**·source?·vendor?·moistureBasis?·sortOrder), `NutrientValues`, `NutrientKey`
- `src/features/nutrition/nutrientKeys.ts` — `NUTRIENT_META`, `CATEGORY_LABELS`, `NutrientCategory` (입력 폼 구성·정렬·라벨·단위)
- `src/features/presets/presetQueries.ts`·`presetMutations.ts`·`presetSelectors.ts` — read/mutation/순수함수 패턴
- `src/pages/PresetsPage.tsx` — 2단 레이아웃·모달·상태분기
- `src/features/recipes/filterDrafts.ts` — 검색 필터 순수함수 패턴

## 3. 구현 단위

### 3-1. `src/features/ingredients/ingredientQueries.ts` (신규)

```ts
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Ingredient } from '../../types/recipe'

export async function fetchIngredients(uid: string): Promise<Ingredient[]> {
  const snap = await getDocs(collection(db, `recipesssIngredients/${uid}/items`))
  return snap.docs
    .map((d) => ({ ...(d.data() as Ingredient), id: d.id }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function useIngredients(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipesssIngredients'], // SPEC §8.2 (uid 미포함, DL-015)
    queryFn: () => fetchIngredients(uid as string),
    enabled: !!uid,
  })
}
```

### 3-2. `src/features/ingredients/ingredientSelectors.ts` (신규) — 순수 + 테스트

```ts
import type { Ingredient } from '../../types/recipe'

export function filterIngredients(items: Ingredient[], search: string): Ingredient[]
// name/displayName 부분일치(소문자), 빈 검색은 전체

export function groupByKind(items: Ingredient[]): {
  ingredient: Ingredient[]
  supplement: Ingredient[]
}
// kind별 분리, 각 sortOrder 정렬

export function filledNutrientCount(profile: NutrientValues | undefined): number
// nutrientProfile에 값이 들어찬 키 개수 (목록에 "영양값 N개" 뱃지용)
```
**테스트** `ingredientSelectors.test.ts`: 검색 일치/빈검색, kind 그룹, filledCount(빈/일부).

### 3-3. `src/features/ingredients/ingredientMutations.ts` (신규)

```ts
// 0.5-D presetMutations 패턴. 전체 Ingredient setDoc (부분 update 아님).
export function useUpdateIngredient(uid: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ingredient: Ingredient) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(doc(db, `recipesssIngredients/${uid}/items`, ingredient.id), ingredient)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipesssIngredients'] }),
  })
}
```
- **전체 객체 setDoc** — 편집 시 기존 필드(name·kind·aliases·source 등) 누락 없게 원본 ingredient에 `nutrientProfile`만 교체해서 넘긴다.
- **`undefined` 필드 금지**(Firestore 거부). nutrientProfile은 값 있는 키만(빈칸 키 생략).

### 3-4. `src/features/ingredients/nutrientProfileForm.ts` (신규) — Zod

```ts
import { z } from 'zod'
// 영양소별 optional number. 빈 문자열 → undefined (키 생략).
// react-hook-form defaultValues는 문자열로, 제출 시 number 변환.
```
- 각 `NutrientKey`를 optional 숫자 필드로. `z.coerce.number().nonnegative().optional()` + 빈 문자열 처리(`z.preprocess` 또는 `''→undefined`).
- 폼 필드는 `NUTRIENT_META`로 동적 구성(하드코딩 45개 X). 카테고리·순서·라벨·단위는 메타에서.

### 3-5. `src/pages/IngredientsPage.tsx` (신규)

- `useAuthStore` uid, `useIngredients(uid)`, `useUpdateIngredient(uid)`
- 좌측: 원료 목록 — `groupByKind` + 검색(`filterIngredients`). 각 행: 이름 + `filledNutrientCount` 뱃지("영양값 N/총")
- 우측(또는 모달): 선택 원료의 `nutrientProfile` 편집 폼
  - `CATEGORY_LABELS` 섹션별로 묶고, 각 섹션에 해당 `NUTRIENT_META` 입력(라벨 + number input + 단위 표시)
  - react-hook-form(`zodResolver`). defaultValues = 선택 원료의 nutrientProfile(빈 키는 빈칸)
  - 저장 → 폼값에서 빈칸 제외하고 `nutrientProfile` 조립 → `{ ...ingredient, nutrientProfile }` → `useUpdateIngredient`
- 상태: 로딩/에러/원료없음/미선택 안내. 저장 중 disabled, 실패 에러 표시.
- 클래스: `CARD_CLS`·`INPUT_CLS`·`PRIMARY_BTN_CLS`·`EMPTY_STATE_CLS` 등 `src/lib/ui.ts` 재사용.

### 3-6. `src/routes/appRouter.tsx` (수정)

```tsx
import { IngredientsPage } from '../pages/IngredientsPage'
// { path: '/ingredients', element: <IngredientsPage /> }  // PlaceholderPage 교체
```
- 다른 라우트가 아직 `PlaceholderPage`를 쓰면 import 남길 것.

## 4. 제약

- `tsconfig.app.json`: `verbatimModuleSyntax`(`import type`), `erasableSyntaxOnly`(**enum 금지**, union), `noUncheckedIndexedAccess`
- 상대경로 import, alias 없음
- `ingredientSelectors.ts`·`nutrientProfileForm.ts`는 가급적 순수(폼 스키마는 zod만)
- **write는 `recipesssIngredients/{uid}/items` 만.** 다른 컬렉션 금지
- **전체 객체 setDoc** — 기존 필드 보존, `undefined` 필드 금지
- **nutrientProfile은 값 있는 키만**(빈칸 = 키 생략). `null` 저장하지 말 것(타입 `NutrientValues`는 number만 — §아키텍트 노트)
- 1-A 산출물(`types/recipe.ts`, `nutrition/*`) **수정 금지** — 읽기만
- 새 라이브러리 금지(`@hookform/resolvers`·zod·react-hook-form 이미 있음)

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과, 순수함수 테스트 포함
- `npm run dev` → `/ingredients`:
  - 원료 91개가 kind(원료/영양제) 그룹으로 목록 표시, 검색 동작
  - 원료 선택 → 카테고리별 영양값 폼 → 값 입력·저장 → Firestore 반영 + 목록 뱃지 갱신(invalidate)
  - 저장한 값이 새로고침 후 유지
- DevTools Network: 저장 시 `recipesssIngredients` write만(전체 객체)

## 6. 보고 양식

- 변경/신규 파일, 순수함수 테스트 수
- 빈칸 처리(키 생략) 방식, 전체-객체 setDoc로 필드 보존 확인
- nutrientProfile 폼을 `NUTRIENT_META`로 동적 구성했는지
- 빠뜨린 것·애매했던 결정 surface
- side effect(특히 write 경로) 가능성

---

## 아키텍트 노트 (Claude → Codex)

- **null vs 키 생략**: SPEC §5.4/§7.2는 결측을 `null`로 저장(USDA에서 못 가져온 것 구분)이라지만, 1-A에서 `NutrientValues = Partial<Record<NutrientKey, number>>`로 확정돼 **null이 타입상 불가**다. 1-C(수동 입력)는 빈칸 = **키 생략**으로 처리한다. null 결측 구분은 USDA(단계 2)에서 타입 확장 시 다룬다. 이 불일치는 의도적으로 단계 2로 미룬다 — 임의로 타입 바꾸지 말 것.
- **전체 객체 setDoc**(0.5-D와 동일)인 이유: 부분 `updateDoc`은 필드 누락·중첩 머지 함정이 있다. 원본 ingredient를 받아 `nutrientProfile`만 교체해 통째로 쓰면 안전하고 리뷰 쉽다.
- **폼은 메타 기반 동적 생성**: 영양소 45개를 손으로 나열하지 말고 `NUTRIENT_META`를 순회해 카테고리 섹션·입력·단위를 만든다. 1-A에서 키가 늘면 폼도 자동 반영된다.
- **이번은 "편집"만**: 원료 추가/삭제/USDA/드래그는 뺐다. 91개 빈 원료에 값을 채우는 게 1-D 매트릭스의 전제라, 그 최소 경로에 집중한다. 원료 추가는 USDA(단계 2)와 함께가 자연스럽다.
- 다음 1-D(매트릭스)는 이 영양값 + 1-B 엔진(`evaluateDraft`)으로 부족분 표를 그린다. 1-C가 데이터를 채우면 1-D가 의미를 갖는다.
