# Codex 지시서 — Step 0.5-E: 발주 페이지 (`/orders`)

> 작성: Claude (아키텍트) · 2026-06-04 · 구현: Codex
> 정본: **SPEC.md §5.6, §8.2**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 단계 0.5 이식의 **발주** 화면. 0.5-D(프리셋 설정)에서 만든 프리셋을 **선택**해서 이번 회차 주문량을 입력하고 **간결하게 표시**하는 화면이다.
- 데이터는 전부 이미 존재: `recipesssPresets/{uid}/items/*`(프리셋 100개) + `recipeDrafts/{uid}/items/*`(레시피 27개). 마이그레이션 완료됨.
- **이 페이지는 쓰기(write)가 없다.** 발주 = 이번 회차에 무엇을 얼마나 만들지 고르는 일회성 입력이고, SPEC §8.2 Query 키에도 발주 컬렉션이 없다. 선택·주문량은 **컴포넌트 로컬 state**로만 둔다 (Firestore 저장 X). 자세한 근거는 §아키텍트 노트.
- 기존 쿼리(`usePresets`, `useRecipeDrafts`)를 **그대로 재사용**한다. 신규 쿼리·mutation·라이브러리 **추가 금지**.

## 1. 목표·범위

### IN (이번에 구현)

1. 레시피(=draft)별로 그룹화된 프리셋 목록 표시. 그룹 헤더 = `(고양이)치킨` 형식.
2. 프리셋을 **체크박스로 선택/해제**.
3. 선택된 프리셋에 **회차 주문량(개수)** 입력란.
4. **간결 표시**: 선택+주문량을 한 줄 한 줄 요약. 예: `(고양이)치킨  a0 20개 / a1 40개`.
5. 로딩 / 에러 / 빈 상태(프리셋 없음, 선택 없음) 처리.
6. 라우터에서 `/orders` PlaceholderPage → `OrdersPage` 교체.

### OUT (이번에 만들지 말 것 — 후속/다른 단계)

- ❌ **영양제 그램 매트릭스**(선택 프리셋 × 영양제 투입량 표). v2 발주 탭 우측의 그 표는 composition × ratio 계산이라 **단계 1·2(영양 엔진)** 소관. 이번에 만들지 말 것.
- ❌ **출력/PDF 미리보기 연동**(`/print/:recipeId`) — **단계 4**. 버튼은 두되 `disabled`(아래 3-6 참고).
- ❌ **발주 내역 저장/이력**(Firestore write, 회차 기록 컬렉션) — 범위 밖. 로컬 state만.
- ❌ 프리셋 CRUD(0.5-D `/presets`에서 이미 함). 발주 화면에서 프리셋을 추가/편집/삭제하지 않는다.

## 2. 먼저 읽을 것

- `SPEC.md` §5.6(발주), §8.2(Query 키 정책 — 1인 사용, uid 미포함)
- `src/types/recipe.ts` — `Preset`, `RecipeDraft`, `Species` 타입 (그대로 사용)
- `src/features/presets/presetQueries.ts` — `usePresets` (재사용)
- `src/features/recipes/recipeQueries.ts` — `useRecipeDrafts` (재사용)
- `src/features/presets/presetSelectors.ts` — 순수 함수 + 테스트 분리 패턴(참고)
- `src/pages/PresetsPage.tsx` — 2단 레이아웃·상태분기·클래스 패턴(참고)
- `src/pages/RecipesPage.tsx` — `speciesLabel` 패턴(참고)
- `src/lib/ui.ts` — 클래스 상수

## 3. 구현 단위

### 3-1. `src/features/orders/orderSelectors.ts` (신규) — 순수 함수 + 테스트 ★

> **이 파일이 발주 로직의 핵심이다.** UI 없이 회귀 테스트 가능하게 순수 함수로 뽑는다. React/Firebase import 금지.

타입과 함수 시그니처(이대로 구현):

```ts
import type { Preset, RecipeDraft, Species } from '../../types/recipe'

// 화면 그룹: 한 레시피(draft) + 그 레시피의 프리셋들
export type OrderGroup = {
  draftId: string
  draftName: string
  species: Species
  unitLabel: string // draft.unitLabel (예: '마리', '개'). 빈 문자열 가능
  presets: Preset[]
}

// 선택 상태: presetId → 주문량(개수). 키가 있으면 '선택됨'.
export type OrderSelection = Record<string, number>

// 요약 한 줄
export type OrderSummaryItem = { code: string; quantity: number }
export type OrderSummaryGroup = {
  draftId: string
  label: string // 예: '(고양이)치킨'
  unitLabel: string
  items: OrderSummaryItem[]
}

// 종 라벨 (RecipesPage 와 동일 규칙; 이 함수는 Species 입력)
export function speciesLabel(species: Species): string {
  if (species === 'cat') return '고양이'
  if (species === 'dog') return '강아지'
  return '미지정'
}

// 그룹 헤더 라벨: '(고양이)치킨'
export function groupLabel(draft: RecipeDraft): string {
  return `(${speciesLabel(draft.species)})${draft.name}`
}

// 레시피별로 프리셋을 묶는다.
// - 프리셋이 1개 이상인 draft만 포함
// - draft 는 draft.sortOrder 오름차순, 그룹 내 preset 은 preset.sortOrder 오름차순
// - draft 가 없는 고아 프리셋(매칭 draft 없음)은 제외
export function groupPresetsByRecipe(
  drafts: RecipeDraft[],
  presets: Preset[],
): OrderGroup[] {
  // 구현: draftId → Preset[] 매핑 후, drafts 순회하며 그룹 생성
}

// 선택+주문량을 요약 그룹으로. 선택된 프리셋만, 선택 있는 그룹만.
// - 그룹/아이템 순서는 groups 의 순서(=sortOrder)를 유지
export function buildOrderSummary(
  groups: OrderGroup[],
  selection: OrderSelection,
): OrderSummaryGroup[] {
  // 구현: 각 group.presets 중 selection 에 키가 있는 것만 items 로
}

// 요약 한 줄 문자열: '(고양이)치킨  a0 20개 / a1 40개'
// - unitLabel 이 빈 문자열이면 단위 없이 수량만 ('a0 20')
export function formatOrderLine(group: OrderSummaryGroup): string {
  const unit = group.unitLabel
  const body = group.items
    .map((it) => `${it.code} ${it.quantity}${unit}`)
    .join(' / ')
  return `${group.label}  ${body}`
}

// 선택된 프리셋 총 개수(헤더 표시용, 선택)
export function totalSelectedCount(selection: OrderSelection): number {
  return Object.keys(selection).length
}
```

**테스트** `orderSelectors.test.ts` (최소 케이스):
- `speciesLabel`: cat→'고양이', dog→'강아지', null→'미지정'
- `groupLabel`: `(고양이)치킨` 조합
- `groupPresetsByRecipe`:
  - draft.sortOrder / preset.sortOrder 정렬 확인
  - 프리셋 없는 draft 제외
  - draft 없는 고아 프리셋 제외
  - species·unitLabel 가 draft 에서 옴
- `buildOrderSummary`:
  - 선택된 프리셋만 포함
  - 선택 없는 그룹은 결과에서 빠짐
  - 그룹/아이템 순서 유지
  - quantity 가 selection 값으로 매핑
- `formatOrderLine`: 단위 있음(`a0 20개 / a1 40개`) / 단위 빈 문자열(`a0 20`) / 아이템 1개

### 3-2. `src/pages/OrdersPage.tsx` (신규)

구조(PresetsPage 패턴 따름):

- `const uid = useAuthStore((s) => s.user?.uid)`
- `const draftsQuery = useRecipeDrafts(uid)` / `const presetsQuery = usePresets(uid)`
- `const groups = useMemo(() => groupPresetsByRecipe(drafts, presets), [drafts, presets])`
- 선택 상태: `const [selection, setSelection] = useState<OrderSelection>({})`
  - **toggle(체크)**: 켜면 `{ ...sel, [id]: 0 }`, 끄면 해당 키 삭제(나머지로 새 객체 구성)
  - **주문량 변경**: 체크된 항목만. `{ ...sel, [id]: n }`. `n`은 `Number(e.target.value)`를 `Number.isFinite` 확인 후 `Math.max(0, ...)`, 비었으면 0.
- `const summary = useMemo(() => buildOrderSummary(groups, selection), [groups, selection])`

레이아웃(2단 권장: 좌 선택 / 우 요약, `lg:grid-cols-[1fr_360px]`. 모바일은 세로 스택):

좌측(선택 영역) — 그룹별 카드:
- 카드 헤더: `groupLabel(draft)` + `프리셋 N개`
- 각 프리셋 행: `<input type="checkbox">` + `preset.code` + `preset.label`(있으면) + 체크 시 우측에 주문량 `<input type="number" min="0" step="1">` + 단위 표시(`unitLabel`)
- 체크 안 된 행은 주문량 input 숨김(또는 disabled)

우측(요약 영역):
- `summary` 가 비면 안내(`프리셋을 선택해 주문량을 입력하세요.`)
- 아니면 `summary.map`으로 `formatOrderLine(group)`을 한 줄씩(`<div>` 또는 `<li>`). 모노스페이스/`text-sm`로 간결하게.
- 하단에 "출력 미리보기 생성" 버튼 → 3-6 참고(disabled)

상태 분기(PresetsPage와 동일):
- `isLoading = draftsQuery.isLoading || presetsQuery.isLoading`
- `isError` / `queryError` 동일 패턴, 에러 박스
- 데이터 있는데 `groups.length === 0`: `발주할 프리셋이 없습니다. 프리셋 설정에서 추가하세요.`

상수:
- `const EMPTY_DRAFTS: RecipeDraft[] = []`, `const EMPTY_PRESETS: Preset[] = []` (PresetsPage 패턴; `data ?? EMPTY_*`)
- 클래스: `CARD_CLS`, `EMPTY_STATE_CLS`, `INPUT_CLS`(또는 `CELL_INPUT_CLS`), `PRIMARY_BTN_CLS`, `SECONDARY_BTN_CLS` 재사용
- `export function OrdersPage()` + `export default OrdersPage`

### 3-6. 출력 미리보기 버튼 (단계 4 seam)

- `<button className={PRIMARY_BTN_CLS} disabled title="단계 4에서 구현">출력 미리보기 (단계 4)</button>`
- onClick 없음. **navigate 하지 말 것.** §5.6의 "출력 미리보기 → /print" 흐름의 자리만 표시.

### 3-7. `src/routes/appRouter.tsx` (수정)

```tsx
import { OrdersPage } from '../pages/OrdersPage'
// ...
{ path: '/orders', element: <OrdersPage /> },  // PlaceholderPage 교체
```
- `PlaceholderPage` import 가 다른 라우트에서도 쓰이면 **지우지 말 것**(여러 라우트가 아직 placeholder). import 정리는 안 쓰일 때만.
- 좌측 네비에 `발주` 링크는 이미 있음(placeholder 시절부터 도달 가능). 네비 변경 불필요 — 다만 `/orders` 가 메뉴에 보이는지만 dev에서 확인.

## 4. 제약

- `tsconfig.app.json`: `verbatimModuleSyntax`(`import type`), `erasableSyntaxOnly`(**enum 금지**, union 사용), `noUncheckedIndexedAccess`
- 상대경로 import, alias 없음
- **Firestore write 절대 금지.** 이 페이지는 read-only. `setDoc`/`deleteDoc`/`updateDoc` 호출이 하나도 없어야 한다.
- 신규 쿼리/mutation/라이브러리 추가 금지. `usePresets`·`useRecipeDrafts` 재사용.
- `orderSelectors.ts` 는 순수 — `react`/`firebase`/`@tanstack` import 금지.
- `noUncheckedIndexedAccess` 주의: `selection[id]`, 배열 인덱스 접근 시 `undefined` 가능성 처리(요약 매핑은 `selection` 키 존재로 필터한 뒤 값 사용).
- 선택 해제 시 키 삭제는 새 객체로(불변): `const next = { ...sel }; delete next[id]; setSelection(next)` 또는 동등 방식.

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과
- `npm run dev` → `/orders`:
  - 레시피별로 프리셋이 그룹지어 보임(헤더 `(고양이)…`)
  - 체크 → 주문량 입력 → 우측 요약에 `(고양이)치킨  a0 20개 / a1 40개` 식으로 즉시 반영
  - 체크 해제 → 요약에서 사라짐
  - 새로고침하면 선택이 사라짐(=로컬 state, 정상)
- DevTools Network: `/orders` 조작 시 Firestore **write 요청이 없음** 확인(read만)

## 6. 보고 양식

- 변경/신규 파일 목록
- 순수 함수 테스트 케이스 수
- 내린 결정: 선택 state 구조(키=선택), 주문량 단위 출처(`draft.unitLabel`), write 없음 확인
- unitLabel 이 비어있는 레시피가 있었는지(있으면 단위 없이 수량만 나오는지)
- 빠뜨린 것·애매했던 결정 surface
- side effect 가능성(read-only 라 거의 없음 — 그래도 확인)

---

## 아키텍트 노트 (Claude → Codex)

- **write 없는 이유**: SPEC §8.2 Query 키 목록에 발주/주문 컬렉션이 없다. §5.6의 발주 흐름은 "선택→주문량→출력 미리보기(/print)"로, 주문량은 이번 회차에만 쓰는 일회성 입력이지 영속 데이터가 아니다. 회차 이력을 저장하는 건 별도 결정(DL 신설)이 필요하므로 **이번엔 로컬 state**로만 둔다. 만약 호두님이 "발주 내역을 저장하고 싶다"고 하면 그건 새 스코프 — 멈추고 surface.
- **v2 발주 탭과의 차이**: v2 우측은 `영양제 × 프리셋` 그램 매트릭스(`row.weight * ratio`)였다. 그건 composition·영양 엔진(단계 1·2)과 /print(단계 4)에 묶여 있어 0.5에서 빼는 게 맞다. 0.5의 발주는 "무엇을 얼마나"까지만. 매트릭스를 끌고 오면 단계 경계가 무너진다.
- **주문량 단위**: SPEC §5.6 예시는 `20개 / 100g / 1마리`로 단위가 제각각이다. 레시피의 생산단위(`draft.unitLabel`)를 그대로 단위로 쓴다(마이그레이션이 채워둠). 비어있으면 수량만. 단위를 별도 입력받지 않는다(단순화). 이게 §5.6 의도와 맞고 0.5-D 출력1의 생산단위와도 일관.
- **선택 state = `Record<presetId, number>`**: 키 존재 = 선택, 값 = 주문량. checkbox와 수량을 한 자료구조로 묶어 버그 여지를 줄인다. 순수 함수는 이 구조를 입력으로 받아 테스트하기 쉽다.
- **순수 함수 분리**: 0.5-A~D와 동일 철학. 정렬·그룹·요약·포맷을 `orderSelectors.ts`에 모아 UI 없이 회귀 테스트. 나중에 출력 연동(단계 4)이 붙어도 이 집계 함수는 재사용된다.
- **고아 프리셋**: draftId가 현재 draft 목록에 없는 프리셋은 그룹에서 제외(표시 못 함). 마이그레이션이 정합하면 0건이어야 한다. 만약 dev에서 프리셋이 적게 보이면 고아 프리셋 가능성 — 보고에 적어줘(데이터 정합성 신호).
- **placeholder import**: `/orders`만 교체. 다른 라우트가 아직 `PlaceholderPage`를 쓰므로 import는 남겨둘 것.
