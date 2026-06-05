# Codex 지시서 — Step 1-B: 영양 계산 엔진 (순수 함수)

> 작성: Claude (아키텍트) · 2026-06-05 · 구현: Codex
> 정본: **SPEC.md §6 (계산 엔진), §9.1 (테스트)**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 단계 1-A(`2ea1978`)에서 영양 **데이터·타입 기반**이 깔렸다. 이제 그 위에 **순수 계산 엔진**을 얹는다.
- 1-A 산출물(이미 존재, 그대로 사용):
  - `src/types/recipe.ts` — `NutrientKey`(~45), `NutrientValues`(`Partial<Record<NutrientKey, number>>`), `NutrientProfile`, `NutrientRequirement`(`min: number; max?; maxType?`), `RecipeDraft`, `Ingredient`, `CompositionRow`
  - `src/features/nutrition/nutrientKeys.ts` — 키 메타
  - `src/features/nutrition/profiles/*` — FEDIAF 2025 7종 + 레지스트리(`getProfile`, `profilesForSpecies`)
- **이 엔진은 순수**다 (SPEC §0 도메인 격리): `src/features/nutrition/*`는 React·Firebase·@tanstack import **금지**. 입력은 인자로만 받는다.
- **표준 데이터 양과 무관**하게 동작해야 한다 (FEDIAF/AAFCO/NRC 모두 같은 `NutrientProfile` 타입). 나중에 표준이 추가돼도 엔진 변경 없음.

## 1. 목표·범위

### IN (이번에 구현)

SPEC §6.1~6.5의 순수 함수 + Vitest **30+ 케이스**(SPEC §9.1 강제):
1. ME (§6.1), NFE (§6.2)
2. 환산 (§6.3): `sumRecipeNutrients`, `totalWeightG`, `per1000kcalME`, `perKgDryMatter`
3. 부족분 판정 (§6.4): `evaluateDraft`, `evaluateRatios` (+ `AdequacyResult`, `RatioResult` 타입)
4. 계산↔확정 동기화 (§6.5): `syncDeclaredFromCalculated`, `effectiveNutrient`

### OUT (이번에 만들지 말 것)

- ❌ UI / 매트릭스 컴포넌트 (1-D)
- ❌ 원료 영양값 입력 UI (1-C)
- ❌ Firestore 읽기/쓰기, React 훅
- ❌ `draftToRecipe`(§6.6) — 단계 3 (푸시) 소관
- ❌ 표준 데이터 추가 (AAFCO/NRC) — Claude가 별도로 진행 중. 엔진은 건드리지 말 것.

## 2. 먼저 읽을 것

- `SPEC.md` §6 전체(특히 6.1~6.5 코드 블록), §9.1(테스트 대상·30+ 강제)
- `src/types/recipe.ts` — 위 타입들. **특히** `NutrientRequirement.min`은 required, `max?`·`maxType?` optional. `NutrientProfile.perMe`/`perDm`/`ratios.caP`.
- `src/features/nutrition/profiles/fediaf2025.ts` — 실제 프로파일 형태(테스트 fixture로 활용 가능)
- `src/features/presets/presetSelectors.ts` 등 — 순수 함수 + 테스트 분리 패턴

## 3. 구현 단위

> 파일 분할 권장: `src/features/nutrition/calc.ts`(ME·NFE·환산), `src/features/nutrition/evaluate.ts`(판정), `src/features/nutrition/declared.ts`(동기화). 각 `*.test.ts`. 한 파일에 몰아도 되나 테스트 가독성 위해 분할 권장.

### 3-1. ME · NFE (§6.1, §6.2)

```ts
// 입력 values = 100g 당 영양값 (NutrientValues)
export function nfeGPer100g(values: NutrientValues): number {
  const dm = 100 - (values.moisture ?? 0)
  const known = (values.crudeProtein ?? 0) + (values.crudeFat ?? 0) +
                (values.crudeFiber ?? 0) + (values.ash ?? 0)
  return Math.max(0, dm - known)
}

export function meKcalPer100g(values: NutrientValues): number {
  const p = values.crudeProtein ?? 0
  const f = values.crudeFat ?? 0
  const nfe = nfeGPer100g(values)
  return 3.5 * p + 8.5 * f + 3.5 * nfe
}
```
- SPEC §6.1/6.2 그대로 (키 이름 `crude*` — 1-A에서 정정됨, DL-032). 수정 Atwater 3.5/8.5/3.5 (DL-007).

### 3-2. 환산 (§6.3)

```ts
export type IngredientMap = Record<string, Ingredient>

// 레시피 총 영양량(절대량). 각 원료의 100g당 nutrientProfile × (weight/100) 합산.
export function sumRecipeNutrients(
  draft: RecipeDraft,
  ingredients: IngredientMap,
): NutrientValues

export function totalWeightG(draft: RecipeDraft): number  // composition weight 합

// 총 ME(kcal): 각 원료 meKcalPer100g × weight/100 합산
export function totalMeKcal(draft: RecipeDraft, ingredients: IngredientMap): number

// 영양량을 1000 kcal ME 기준으로 정규화: value × 1000 / totalMe
export function per1000kcalME(values: NutrientValues, totalMe: number): NutrientValues

// 영양량을 건물(DM) 100g 기준으로: value × 100 / totalDmG
export function perKgDryMatter(values: NutrientValues, totalDmG: number): NutrientValues
```

구현 주의:
- `sumRecipeNutrients`: `draft.composition`의 각 `row`에 대해 `ing = ingredients[row.ingredientId]`. 없으면 skip. `ing.nutrientProfile`(없으면 skip)의 각 키에 `value * row.weight / 100` 누적. `noUncheckedIndexedAccess` — `ingredients[id]` undefined 처리.
- `totalMeKcal`: 원료별 `meKcalPer100g(ing.nutrientProfile) * row.weight/100` 합. (NFE가 moisture 의존이라 원료별 계산 후 합산이 정확 — 합산 후 일괄계산과 다를 수 있음. 원료별 계산이 맞다.)
- `per1000kcalME`/`perKgDryMatter`: `totalMe`/`totalDmG`가 0이면 빈 객체 또는 0 처리(0 나눗셈 방지).
- DM(dry matter) 총량: `sum(원료 weight × (100 - moisture%)/100)` — moisture는 원료 nutrientProfile.moisture(100g당 g). 헬퍼 `totalDryMatterG(draft, ingredients)` 추가 권장.
- 함수 시그니처는 SPEC §6.3 유지. `perKgDryMatter` 이름은 SPEC대로 두되 실제 단위(100g DM 기준이면 주석 명확히 — FEDIAF perDm이 per 100g DM이므로 **100g DM 기준으로 통일**. SPEC 함수명과 실제 basis가 어긋나면 주석으로 명시하고 surface).

> ⚠️ **basis 단위 일관성**: 프로파일 `perDm`은 **per 100 g DM**, `perMe`는 **per 1000 kcal ME**다. 판정 시 레시피 환산값도 같은 단위여야 한다. `per1000kcalME`→perMe 비교, `perKgDryMatter`(=per 100g DM로 구현)→perDm 비교. 단위가 어긋나면 판정이 전부 틀린다 — 여기가 제일 중요.

### 3-3. 부족분 판정 (§6.4)

```ts
export type AdequacyStatus = 'ok' | 'deficient' | 'excess'

export type AdequacyResult = {
  nutrient: NutrientKey
  actual: number
  min?: number
  max?: number
  status: AdequacyStatus
  deficit?: number   // min 미달 시 (min - actual)
  excess?: number    // max 초과 시 (actual - max)
}

export type Basis = 'per_1000_kcal_ME' | 'dry_matter'

export function evaluateDraft(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile,
  basis: Basis,
): AdequacyResult[]

export type RatioResult = {
  ratio: 'caP'
  actual: number
  min?: number
  max?: number
  status: AdequacyStatus
}

export function evaluateRatios(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile,
): RatioResult[]
```

구현:
- `evaluateDraft`:
  1. 레시피 환산값 계산: basis에 따라 `per1000kcalME(sum, totalMe)` 또는 `perKgDryMatter(sum, totalDmG)`. 단 **확정값 우선**(§6.5 `effectiveNutrient`) — 아래 3-4와 연동.
  2. 비교 대상 = basis에 따라 `profile.perMe` 또는 `profile.perDm`.
  3. 프로파일에 정의된 각 키에 대해: `actual` = 환산값(없으면 0), `min`/`max` = requirement. `actual < min` → deficient(deficit=min-actual), `max!=null && actual>max` → excess(excess=actual-max), else ok.
  4. 프로파일에 있는 키만 결과에 포함(레시피에만 있고 프로파일에 없는 키는 판정 대상 아님).
- `evaluateRatios`: `profile.ratios?.caP` 있으면 calcium/phosphorus 환산값으로 actual=Ca/P. min/max 비교. (Ca/P는 basis 무관 — 비율이라 동일. phosphorus 0이면 skip/Infinity 처리.)
- **확정값(declaredNutrients) 우선**: `effectiveNutrient`(3-4)로 키별 값 선택. 단 확정값은 "100g당"이 아니라 이미 환산된 값인가? — **확정값도 100g당 절대 기준이 아니라 §6.5 정의대로 `sumRecipeNutrients` 형태(절대량/합산)**. 즉 `effectiveNutrient`는 합산 영양량 레벨에서 확정값을 덮어쓰고, 그 후 basis 환산. (아래 3-4 주석 따르라.)

### 3-4. 계산↔확정 동기화 (§6.5)

```ts
// 계산값(sumRecipeNutrients)을 확정값에 복사. composition 변경 시 호출 (DL-029).
export function syncDeclaredFromCalculated(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  now: number,                // Date.now()는 호출측에서 주입 (순수성 유지)
): RecipeDraft

// 판정에 쓸 값 선택: 확정값 우선, 없으면 계산값.
export function effectiveNutrient(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  key: NutrientKey,
): number | undefined
```
- `syncDeclaredFromCalculated`: `{ ...draft, declaredNutrients: sumRecipeNutrients(...), declaredNutrientsUpdatedAt: now }`. **`Date.now()`를 함수 안에서 부르지 말 것**(순수성·테스트). `now`를 인자로.
- `effectiveNutrient`: `draft.declaredNutrients?.[key]`가 `undefined`/`null` 아니면 그것, 아니면 `sumRecipeNutrients(draft, ingredients)[key]`.
- `evaluateDraft`는 환산 전 영양량을 `effectiveNutrient`로 구성(키별 확정값 우선) 후 basis 환산. (확정값은 `sumRecipeNutrients`와 같은 절대량 스케일임을 전제 — DL-027/029.)

### 3-5. 테스트 (§9.1 — 최소 30 케이스)

- `nfeGPer100g`/`meKcalPer100g`: 알려진 입력→출력, moisture 높을 때, known>dm일 때 0 클램프, 빈 객체.
- `sumRecipeNutrients`/`totalWeightG`/`totalMeKcal`: 단일 원료, 복수 원료, 원료 누락(skip), nutrientProfile 없음(skip).
- `per1000kcalME`/`perKgDryMatter`: 정규화 정확, totalMe=0 방어.
- `evaluateDraft`: deficient/ok/excess 각각, basis 토글(perMe vs perDm) 결과 다름, 프로파일에 없는 키 제외, FEDIAF 실제 프로파일(`getProfile`)로 통합 1케이스.
- `evaluateRatios`: caP ok/deficient/excess, phosphorus 0 방어.
- `effectiveNutrient`/`syncDeclaredFromCalculated`: 확정값 우선, 확정값 없으면 계산값, sync 후 declared 채워짐 + updatedAt=now.

## 4. 제약

- `tsconfig.app.json`: `verbatimModuleSyntax`(`import type`), `erasableSyntaxOnly`(**enum 금지**, union), `noUncheckedIndexedAccess`(맵·배열 인덱스 undefined 처리 필수 — 특히 `ingredients[id]`)
- 상대경로 import, alias 없음
- **순수**: `src/features/nutrition/*`에서 `react`/`firebase`/`@tanstack`/DOM import 금지. `Date.now()`/`Math.random()` 직접 호출 금지(인자 주입).
- 1-A 산출물(타입·프로파일·키메타) **수정 금지**. 읽기만. (Claude가 표준 데이터 추가 작업 중 — 충돌 방지)
- 새 라이브러리 추가 금지.
- SPEC §6 함수 시그니처 유지. 단위(basis) 일관성 위반 시 멈추고 surface.

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과, 영양 테스트 30+ 케이스
- (선택) `getProfile('FEDIAF_2025_CAT_ADULT_MER75')`로 evaluateDraft 통합 테스트가 그럴듯한 결과

## 6. 보고 양식

- 변경/신규 파일, 테스트 케이스 수
- basis 단위 일관성 처리(perMe↔per1000kcal, perDm↔per100gDM) 설명
- 확정값 우선 로직(effectiveNutrient)이 환산과 어떻게 엮이는지
- NFE 원료별 계산 vs 합산후계산 중 택한 것과 이유
- SPEC §6 함수명과 실제 basis가 어긋난 부분(있으면) surface
- 빠뜨린 것·애매했던 결정

---

## 아키텍트 노트 (Claude → Codex)

- **제일 위험한 건 basis 단위 일관성**이다. 프로파일 `perMe`=per 1000 kcal ME, `perDm`=per 100 g DM. 레시피 환산값도 정확히 같은 단위로 만들어 비교해야 한다. 단위가 어긋나면 모든 판정이 조용히 틀린다 — 테스트로 perMe/perDm 양쪽을 꼭 검증하라.
- **순수성**을 지켜라. `Date.now()`를 `syncDeclaredFromCalculated` 인자로 뺀 이유다(테스트 결정성 + 도메인 격리). UI에서 `Date.now()`를 주입한다.
- **확정값 우선(DL-027/028/029)**: 호두님이 라벨링 직전 손으로 미세조정한 값이 정답. `effectiveNutrient`가 그걸 보장한다. 확정값은 `sumRecipeNutrients`와 같은 절대량 스케일(100g당 아님, 레시피 합산량)이다.
- **원료 영양값이 현재 다 빈 객체**다(91개 마이그레이션). 그래서 실제 매트릭스는 단계 1-C(수동입력)/2(USDA) 후에 의미가 생긴다. 1-B는 엔진+테스트까지 — fixture(직접 만든 nutrientProfile)로 검증하면 된다. FEDIAF 프로파일로 비교 로직도 검증 가능.
- 키셋(`NutrientKey`)은 1-A에서 ~45 확정. 내가 AAFCO/NRC 데이터를 추가하며 키가 몇 개 늘 수 있는데(append-only), 엔진은 키 목록에 의존하지 않으니(Partial 순회) 영향 없다. 충돌 안 나게 `types/recipe.ts`·`profiles/*`는 건드리지 말 것.
