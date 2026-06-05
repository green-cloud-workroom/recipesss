# Codex 지시서 — 프리셋 재설계 (v2 회귀: `/presets` 제거 → 레시피 상세 통합)

> 작성: Claude (아키텍트) · 2026-06-05 · 구현: Codex
> 정본: **SPEC.md §5.1·§5.5·§6.7·§13 DL-035**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 기존 별도 페이지 `/presets`(0.5-D/E/F/G)가 호두님 실제 워크플로우(v2 "결과 탭")와 어긋나 코드·생산단위가 꼬임. **v2 방식으로 회귀**한다(DL-035).
- 핵심 전환: 프리셋은 `code`·`targetWeight`를 **직접 입력하지 않는다**. 대신 **생산단위 원료 + 생산량**만 입력 → `targetWeight`·`ratio`·코드를 **자동 도출**.
- 화면: 별도 페이지가 아니라 **레시피 상세 `/recipes/:draftId`**(신규)에 통합. `/recipes` 목록에서 행 클릭 → 상세.
- **이번 범위 = 최소**: 레시피 헤더(read) + 프리셋 패널만. **영양 매트릭스·구성원료 계산표·원가는 1-D**(후속)에서 같은 `/recipes/:draftId`에 얹는다. **만들지 말 것.**
- 별도 진행 중인 [원료 병합 보강 지시서](Codex지시서_원료병합보강_2026-06-05.md)가 `/recipes`에 붉은 "합산 확인" 버튼을 추가한다. 충돌 안 나게 같은 파일(`RecipesPage.tsx`) 수정 시 주의(둘 다 행 영역) — 먼저 머지된 쪽 기준으로 rebase.

## 1. 목표·범위

### IN (이번에 구현)
1. **순수함수** `getPresetRatioInfo`(§6.7) — 생산량→targetWeight/ratio 환산. + 테스트
2. **순수함수** `normalizePresetCodes` — draft 내 targetWeight 오름차순 코드·sortOrder 재할당. + 테스트
3. **레시피 상세 페이지** `/recipes/:draftId`: 헤더 read + 프리셋 패널(단위원료 select·생산량 입력·추가·칩·편집·삭제)
4. `/recipes` 목록 행 클릭 → 상세로 navigate
5. **`/presets` 제거**: 라우트·사이드바 메뉴·`PresetsPage.tsx`·드래그 정렬(`presetReorder*`·`useReorderPresets`) 삭제

### OUT (이번에 만들지 말 것)
- ❌ 영양 매트릭스·구성원료 계산표·원가 (1-D)
- ❌ 레시피 헤더 편집(name/species/unitLabel 변경)·원료 행 편집 — 이번엔 read만
- ❌ 프리셋 드래그 수동 정렬 — DL-035로 폐기(코드=targetWeight 순 고정)
- ❌ 등록(`recipes` 푸시) 흐름 — DL-025, 후속
- ❌ `prices`/원가 (DL-024 placeholder)

## 2. 먼저 읽을 것
- `SPEC.md` §5.1(메뉴), §5.5(프리셋 설정=레시피 상세), §6.7(생산량 환산 규칙·식), §13 DL-035
- `archive/old/v2-source/modules/selectors.js` `getRatioInfo`(L90-110) — 환산식 원본
- `archive/old/v2-source/modules/preset-codes.js` `computeNormalizedPresets` — 재코딩 원본
- `src/types/recipe.ts` — `Preset`(id·draftId·code·targetWeight·label·unitIngredientId·inputAmount·inputUnitLabel·sortOrder·createdAt), `RecipeDraft`, `CompositionRow`
- `src/features/presets/presetCodes.ts` — `pickPrefix`/`parseCode`(재활용), `presetQueries.ts`/`presetMutations.ts`/`presetSelectors.ts`
- `src/pages/PresetsPage.tsx` — 모달·폼·생성 흐름 패턴(흡수 후 삭제)
- `src/pages/RecipesPage.tsx` — 목록 행(클릭 핸들러 추가), `src/routes/appRouter.tsx`, `src/config/navigation.ts`(+`.test.ts`)
- `src/pages/IngredientsPage.tsx` — 2단 레이아웃·`useIngredients`·UI 상수(`lib/ui.ts`) 패턴 참고

## 3. 구현 단위

### 3-1. `src/features/presets/presetRatio.ts` (신규, 순수)
§6.7 그대로 구현. Firebase·React import 금지.
```ts
import type { RecipeDraft } from '../../types/recipe'

export type RatioInfo = {
  ratio: number
  targetWeight: number
  inputUnitLabel: string
  hasInput: boolean
}

export function getPresetRatioInfo(
  draft: RecipeDraft,
  unitIngredientId: string,
  inputAmount: number,
): RatioInfo
```
- 규칙·엣지(unitRow 없음/weight≤0/raw≤0)는 §6.7과 **동일**. v2 `getRatioInfo`와 수치 일치.
- 테스트(`presetRatio.test.ts`): ①마리 단위(`draft.unitIngredientId === unitIngredientId`, unitLabel='마리', raw×unitRow.weight) ②g 단위(unitLabel 없음, raw 그대로) ③kg 단위(raw×1000) ④unitRow 없음→ratio1/targetWeight0/hasInput false ⑤raw≤0→hasInput false ⑥ratio=targetWeight/unitRow.weight 검증.

### 3-2. `src/features/presets/presetCodes.ts` (확장 — 기존 함수 유지)
`normalizePresetCodes` 추가. 기존 `pickPrefix`·`parseCode` 재활용.
```ts
export function normalizePresetCodes(
  presets: Preset[],   // 전체(또는 해당 draft 포함) 프리셋
  drafts: RecipeDraft[],
  draftId: string,
): Preset[]             // 해당 draft 프리셋만 code·sortOrder 재할당된 새 배열
```
- 동작: `presets`에서 `draftId` 것만 골라 `targetWeight` 오름차순 정렬(동률 시 createdAt→id 안정정렬) → `prefix = pickPrefix(presets, drafts, draftId)` 1글자 → suffix 0,1,2…, `sortOrder` 0,1,2… 동일 순위 부여. `code = prefix + suffix`. 변경 없는 것도 동일 객체 반환 OK(상위에서 batch).
- v2 `computeNormalizedPresets`의 **단일 draft 버전**. 다른 draft prefix 충돌 해소는 범위 밖(프리셋이 draft별 1prefix라 단순).
- 테스트(`presetCodes.test.ts`에 추가): targetWeight [200,50,120] → 코드 [X1,X0,X2]·sortOrder 매칭, prefix는 기존 코드 흔한 글자 유지.

### 3-3. `src/features/presets/presetMutations.ts` (확장)
프리셋 저장/삭제가 **항상 normalize 후 batch write**. 새 mutation:
```ts
export function useApplyDraftPresets(uid: string | undefined)
// mutationFn({ upserts: Preset[]; deleteIds: string[] })
//   batch.set(presetRef, p) for upserts; batch.delete for deleteIds; commit
//   invalidate ['recipesssPresets', uid]
```
- 상세 페이지 흐름: 추가/편집/삭제로 **draft의 다음 프리셋 목록** 구성 → 각 프리셋 `getPresetRatioInfo`로 targetWeight 등 채움 → `normalizePresetCodes` → `useApplyDraftPresets({ upserts: 정규화결과, deleteIds })`.
- 기존 `useUpsertPreset`/`useDeletePreset`는 **제거**(상세 페이지로 일원화). 단, OrdersPage가 안 쓰는지 확인 후.
- ⚠️ presetRef 경로 `recipesssPresets/${uid}/items` 유지.

### 3-4. 레시피 상세 페이지 `src/pages/RecipeDetailPage.tsx` (신규)
- 라우트 param `draftId`. `useRecipeDrafts(uid)`에서 해당 draft 찾기(없으면 not-found 상태), `usePresets(uid)`, `useIngredients(uid)`.
- **헤더(read)**: `(종)이름`, `생산단위: {unitLabel}`, 표준명 등. 편집 없음.
- **프리셋 패널**:
  - 입력 행: **단위원료 select**(옵션 = draft.composition의 ingredientId→ingredient.name, 기본값 `draft.unitIngredientId`) + **생산량 input**(number) + **추가** 버튼.
  - 추가 시: `getPresetRatioInfo(draft, 선택ingredientId, 생산량)` → `hasInput` false면 막고 안내. true면 새 Preset 객체(`preset_xxxxxxxx` id, draftId, targetWeight, inputAmount, inputUnitLabel, unitIngredientId, label='', code/sortOrder는 normalize가 채움, createdAt) → 목록에 더해 normalize → `useApplyDraftPresets`.
  - **칩 목록**: 코드 + 환산 표시(예: `X0  20마리 → 200g`). 각 칩 편집(생산량/단위원료 수정)·삭제. 삭제·편집도 normalize 거쳐 저장.
  - 정렬: `selectPresetsByDraft`이 sortOrder 정렬(=targetWeight 순). 드래그 없음.
- 로딩/에러/빈(프리셋 0개) 상태. UI 상수는 `lib/ui.ts`(`CARD_CLS`·`INPUT_CLS`·`PRIMARY_BTN_CLS`·`EMPTY_STATE_CLS`) 사용.
- ⚠️ `crypto.randomUUID()`로 id 생성(기존 PresetsPage `newPresetId` 패턴 재사용).

### 3-5. 라우팅·네비 정리
- `appRouter.tsx`: `/recipes/:draftId` 라우트 추가(element=`RecipeDetailPage`). `/presets` 라우트·`PresetsPage` import **삭제**. `/recipes/new`·`/recipes/draft/:draftId` placeholder는 1-D용이라 **유지**.
  - ⚠️ 라우트 순서: `/recipes/new`·`/recipes/draft/:draftId`가 `/recipes/:draftId`보다 **먼저** 매칭되게(정적 경로 우선) 배치 — 안 그러면 `new`가 `:draftId`로 먹힘. React Router v6는 구체성 우선이라 보통 OK지만 명시 순서로 안전하게.
- `RecipesPage.tsx`: 목록 행 클릭 → `navigate(\`/recipes/${draft.id}\`)`. (병합 보강 지시서의 붉은 버튼과 같은 행 — 버튼 클릭이 행 navigate로 전파 안 되게 `stopPropagation`.)
- `navigation.ts`: 발주 그룹에서 `item(..., '프리셋 설정', '/presets')` **삭제**. `navigation.test.ts`도 그에 맞게 수정(프리셋 설정 항목 단언 제거).
- `PresetsPage.tsx`, `presetReorder.ts`, `presetReorder.test.ts` **삭제**. `useReorderPresets`(presetMutations) **삭제**. `@dnd-kit`은 다른 표(레시피 원료 등)에서 쓰므로 패키지는 유지.
  - 삭제 전 `presetReorder`/`useReorderPresets`/`PresetsPage` 참조가 위 외 더 없는지 grep 확인.

## 4. 검증 게이트
```
npm run typecheck && npm run lint && npm run test && npm run build
```
- 신규 순수함수 테스트 + 기존 테스트 회귀 없음. 삭제로 깨지는 테스트(presetReorder.test 등)는 함께 삭제/수정.
- mojibake 점검: 새 한글 문자열(칩 표시·안내) grep.

## 5. 보고 시 명시
- 변경/삭제/신규 파일, 이유(DL-035 참조), 부작용(특히 라우트 매칭 순서·OrdersPage 영향 없음 확인).
- ⚠️ 워킹트리에 호두님 미커밋 변경(queryKey uid)·병합 보강 지시서 변경과 겹칠 수 있음 → `git add`로 네 파일만 명시 스테이징, 충돌 시 surface.
- `firestore.rules` 변경 불필요(`recipesssPresets` 규칙 이미 있음). 건드리지 말 것.

## 아키텍트 노트
- **환산식은 v2와 수치 동일이 핵심.** `getPresetRatioInfo`는 §6.7 식을 그대로 — 임의 단순화 금지. 마리/개 단위는 `draft.unitIngredientId === 선택 unitIngredientId`일 때만 적용(레시피 단위원료가 아닌 다른 원료를 기준으로 잡으면 g/kg).
- `normalizePresetCodes`는 저장/삭제마다 호출돼 **항상 결정적**이어야 함(같은 입력 → 같은 코드). 마이그레이션 프리셋(~100)도 첫 저장 시 자동 재코딩됨.
- 상세 페이지는 1-D가 매트릭스를 얹을 **컨테이너**다. 헤더·레이아웃을 1-D가 확장하기 쉽게 단순·평면으로. 프리셋 패널을 별 컴포넌트(`PresetPanel`)로 분리하면 1-D와 공존 쉬움(권장).
- 프리셋 `label`은 이번엔 빈 문자열로 둠(입력 UI 선택). v2엔 자유 라벨 있었으나 범위 밖.
