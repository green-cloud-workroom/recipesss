# 레시피 계산기 — 통합 SPEC

> 본 문서는 신규 recipesss(레시피 계산기)의 **유일한 진실 공급원(single source of truth)**.
> 구현 결정·UI 디테일·운영 절차 모두 여기 박는다. 충돌 시 본 문서가 우선.
>
> 변경은 PR 한 줄짜리라도 §13 결정 로그에 기록.

---

## 0. 메타

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 (초안) |
| 최종 갱신 | 2026-06-03 |
| 대상 앱 코드명 | recipesss |
| 대상 리포 | github.com/green-cloud-workroom/recipesss |
| 운영관리앱(mirror 대상) | C:\dev\fantapet-inventory |

### 용어
- **레시피(Recipe)**: 1건의 사료 배합. `species`(cat/dog/null) + `composition`(원료 행).
- **원료(Ingredient)**: 마스터에 등록되는 1건의 식재료/첨가물. `kind`(ingredient/supplement).
- **영양 프로파일(NutrientProfile)**: 영양소별 min/max 표준 (AAFCO/NRC/FEDIAF).
- **부족분 매트릭스**: 영양소 × 생애주기(자견·성견·자묘·성묘) 표.
- **ME**: 대사에너지(Metabolizable Energy), kcal/100g.
- **NFE**: Nitrogen-Free Extract(탄수화물 추정), DM 기준 g.
- **DM**: 건물(Dry Matter), 수분 제외 무게.
- **lifestage**: `cat-growth`, `cat-adult`, `dog-growth`, `dog-adult` 4종.

---

## 1. 목표·범위·비범위

### 목표
1. 호두님(1인) 펫 사료 레시피 작성·계산·검증 통합 도구.
2. 운영관리앱과 시각적·UX·기술 스택을 **동일**하게.
3. 안정성: **스펙 → 구현 → 회귀 테스트** 순서 강제. 즉흥 수정 금지.
4. 단계별 배포 가능: 단계 N 끝나면 항상 동작하는 앱.

### 범위 (MVP에 포함)
- 레시피 입력 (원료·영양제 행 단위, 동등 기능 유지)
- 원가 계산 + 발주 프리셋 (현 기능 100% 이식)
- 원료 마스터에 USDA FoodData Central 영양 데이터 import
- 자견·성견·자묘·성묘 × 영양소 부족분 매트릭스 (AAFCO 기준)
- 레시피 1건 → PDF 출력 (양식 정해진 대로)
- 성분 조회·버전 이력

### 비범위 (MVP 제외)
- 작성자/승인자 분리, 락(lock), 승인 워크플로우 → 1인 사용이므로 불필요
- QR 코드 생성 → 보류 (필요 시 후속 PR)
- 다국어 → 한국어만
- NRC·FEDIAF 표준 → 데이터 적재만 가능하게 스키마는 열어두되 MVP는 AAFCO만 활성화
- 모바일 풀앱 (PWA 설치는 유지)
- 다크 모드 → 라이트만 (운영관리앱과 동일)
- 다중 사용자 권한·role

---

## 2. 스택·의존성

운영관리앱(`fantapet-inventory`)과 **버전 단위까지** 일치시킨다. 신규 의존성 추가 시 운영관리앱 버전 확인 후 결정.

```jsonc
// 운영관리앱 의존성 mirror (package.json)
{
  "dependencies": {
    "@tanstack/react-query": "^5.100.10",
    "clsx": "^2.1.1",
    "firebase": "^12.13.0",
    "lucide-react": "^1.16.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.76.0",
    "react-router-dom": "^6.30.2",
    "recharts": "^3.8.1",
    "tailwind-merge": "^3.6.0",
    "zod": "^4.4.3",
    "zustand": "^5.0.13",

    // recipesss 신규
    "@react-pdf/renderer": "^4.x"      // PDF (DL-004)
  },
  "devDependencies": {
    // 운영관리앱과 동일
    "vite": "^8.0.12",
    "vitest": "^4.1.6",
    "typescript": "~6.0.2",
    "tailwindcss": "^3.4.17",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.3.0",
    "prettier": "^3.8.3",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^29.1.1"
  }
}
```

### Node·npm
- Node 22 LTS (운영관리앱 functions와 동일)
- npm 10+

### 빌드 도구
- Vite 8 (운영관리앱 동일)
- 출력: `dist/` → Firebase Hosting

---

## 3. 디자인 시스템

**원칙**: 운영관리앱과 100% 동일. 운영관리앱 변경 시 recipesss도 같이 따라간다.

### 3.1 Tailwind 토큰

운영관리앱 `tailwind.config.ts`를 **그대로 복사**한다.

```ts
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: { md: '6px', pill: '12px', sm: '4px' },
      colors: {
        border: 'var(--fp-border)',
        danger: 'var(--fp-danger)',
        muted: 'var(--fp-muted)',
        primary: { DEFAULT: 'var(--fp-primary)', dark: 'var(--fp-primary-dark)' },
        surface: 'var(--fp-surface)',
      },
      fontFamily: { sans: ['Noto Sans KR', 'sans-serif'] },
      fontSize: {
        body: ['13px', '1.45'],
        caption: ['11px', '1.4'],
        helper: ['12px', '1.45'],
        title: ['15px', '1.35'],
      },
      spacing: { compact: '6px' },
    },
  },
}
```

### 3.2 색 토큰 상태 (DL-003 보강)

**현재 운영관리앱 상태**: `--fp-*` CSS 변수는 `tailwind.config.ts`에 선언만 되어 있고 어디에도 정의되어 있지 않다. 실제 스타일은 Tailwind 기본 팔레트(gray-*, red-*, green-* 등)를 직접 사용 중.

**recipesss 정책**: 운영관리앱과 동일하게 둔다. `--fp-*`는 미정의 상태로 mirror. 실제 스타일은 §3.3의 클래스 상수 사용.

운영관리앱이 향후 `--fp-*`를 정의하면 recipesss도 동일 시점에 따라간다.

### 3.3 실제 사용 중인 클래스 상수 (운영관리앱 `lib/ui.ts`)

`src/lib/ui.ts` 파일로 **완전 복제**.

| 상수 | 값 | 용도 |
|---|---|---|
| `PRIMARY_BTN_CLS` | `rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50` | 주 액션 버튼 |
| `PRIMARY_BTN_SM_CLS` | `rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50` | 작은 주 버튼 |
| `SECONDARY_BTN_CLS` | `rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50` | 보조 버튼 |
| `INPUT_CLS` | `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none` | 입력 |
| `CELL_INPUT_CLS` | `w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none` | 표 셀 입력 |
| `INLINE_LINK_CLS` | `text-xs text-blue-600 hover:underline` | 인라인 링크 |
| `INLINE_DANGER_CLS` | `text-xs text-red-400 hover:underline` | 인라인 위험 액션 |
| `CARD_CLS` | `overflow-hidden rounded-lg bg-white shadow-sm` | 카드 컨테이너 |
| `EMPTY_STATE_CLS` | `rounded-lg bg-white p-10 text-center text-sm text-gray-400 shadow-sm` | 빈 상태 |

### 3.4 shadcn 컴포넌트 채택 목록

운영관리앱의 `src/components/ui/` 10개 전부 mirror (변형/props 시그니처 동일):
- `Button` (variant: primary/outline/ghost/danger)
- `Card`, `CardHeader`, `CardContent`
- `Input`, `Textarea`
- `Select`
- `Checkbox`
- `Dialog` → `DialogPanel`
- `Badge` (variant: muted/success/danger)
- `Table`
- `Tabs`

**주의**: 현재 운영관리앱에서 이들 컴포넌트의 `fp-*` 클래스는 시각적으로 무효. 실제 스타일은 §3.3 상수로 처리. recipesss도 동일하게 함.

### 3.5 레이아웃 패턴

**AppLayout** (운영관리앱 mirror):
- 메인 배경: `bg-gray-50`
- 사이드바: 256px(`w-56`), 흰 배경, 우측 `border-gray-200`, active = `bg-gray-800 text-white`, hover = `bg-gray-100`
- 데스크탑(`md:` 이상): 사이드바 고정 좌측, 메인 우측
- 모바일: 햄버거 헤더 + 슬라이드인 사이드바 (블랙 30% overlay)
- 메인 영역: `flex-1 overflow-auto p-4 md:p-6`
- 사이드바 푸터: 사용자 이메일·역할·로그아웃 (recipesss는 1인이므로 단순 표시만)

**모달** (`components/common/Modal.tsx`):
- 백드롭: `fixed inset-0 z-50 bg-black/40 p-4`
- 패널: `max-w-md rounded-xl bg-white shadow-xl`
- 헤더(`border-b`) / 본문(`p-5`) / 푸터(`border-t`, 우측 정렬, 취소·저장)

**토스트** (`components/common/Toast.tsx`):
- 위치: `fixed right-4 top-4 z-50`
- 톤: success=green, error=red, info=gray (각각 border-*-200, bg-*-50, text-*-700)
- 자동 dismiss: 3500ms

### 3.6 운영관리앱 mirror 원칙
1. **운영관리앱이 변경되면 recipesss도 같은 PR로 따라가는 것을 원칙으로 한다.**
2. recipesss 고유 디자인이 필요한 경우(예: 영양 매트릭스 셀 색상) §13 결정 로그에 명시.
3. shadcn 컴포넌트는 운영관리앱에 새 것이 추가되면 같이 추가.

---

## 4. 도메인 모델

스키마 버전을 v3으로 올린다. v2 → v3 마이그레이션은 §11.

### 4.1 Recipe (현행 Product 개념)

```ts
type Recipe = {
  id: string                    // 'rec_xxxxxxxx'
  name: string                  // '치킨'
  species: 'cat' | 'dog' | null
  unitIngredientId: string      // 생산단위 기준 원료 id (현행 유지)
  unitLabel: string             // 예: '마리'
  composition: CompositionRow[]
  // 신규
  standardId: string            // NutrientProfile id (기본: AAFCO_2024_DOG/CAT)
  createdAt: number
  updatedAt: number
}

type CompositionRow = {
  ingredientId: string
  weight: number                // g 기준 항상
  unit: 'g' | 'kg'              // 표시용
}
```

### 4.2 Ingredient (확장)

```ts
type Ingredient = {
  id: string                    // 'ing_xxxxxxxx'
  name: string                  // '닭가슴살'
  kind: 'ingredient' | 'supplement'
  displayName: string           // 치환명 (선택)
  aliases: string[]
  hidden: boolean
  // 신규
  nutrientProfile?: NutrientValues   // 100g 당 영양값 (USDA import or 수동)
  source?: {
    type: 'usda' | 'manual'
    fdcId?: number              // USDA FoodData Central ID
    importedAt?: number
  }
  vendor?: { name: string; url?: string }
  // 수분보정용
  moistureBasis?: 'as-fed' | 'dry-matter'   // 기본 as-fed
}
```

### 4.3 NutrientValues (영양소 키-값)

```ts
// 모든 단위는 100g 당으로 표준화. 영양소 키는 고정 enum.
type NutrientKey =
  // 일반성분
  | 'protein' | 'fat' | 'fiber' | 'ash' | 'moisture' | 'nfe' | 'energy_kcal'
  // 아미노산 (예시; 전체는 §5.4)
  | 'aa_taurine' | 'aa_methionine' | 'aa_cystine' | 'aa_lysine' | /* ... */
  // 지방산
  | 'fa_linoleic' | 'fa_ala' | 'fa_epa' | 'fa_dha' | 'fa_arachidonic'
  // 미네랄
  | 'min_ca' | 'min_p' | 'min_k' | 'min_na' | 'min_cl' | 'min_mg'
  | 'min_fe' | 'min_cu' | 'min_mn' | 'min_zn' | 'min_i' | 'min_se'
  // 비타민
  | 'vit_a' | 'vit_d' | 'vit_e' | 'vit_k' | 'vit_b1' | 'vit_b2' | /* ... */ | 'vit_choline'

type NutrientValues = Partial<Record<NutrientKey, number>>
// 값 단위 표(§6.3 매핑 테이블 참조)
```

### 4.4 NutrientProfile (표준)

```ts
type NutrientProfile = {
  id: string                    // 'AAFCO_2024_DOG_GROWTH', 'AAFCO_2024_CAT_ADULT' 등
  name: string                  // 표시명
  standard: 'AAFCO' | 'NRC' | 'FEDIAF'
  version: string               // 'AAFCO 2024'
  species: 'cat' | 'dog'
  lifestage: 'growth' | 'adult' | 'all-life-stages' | 'gestation-lactation'
  basis: 'per_1000_kcal_ME' | 'dry_matter'
  limits: Record<NutrientKey, { min?: number; max?: number; ratio?: { with: NutrientKey; min: number; max: number } }>
}

// 'ratio'는 Ca:P 같은 비율 제약 표현용
// MVP는 AAFCO_2024_*만 적재 (4개: dog-growth, dog-adult, cat-growth, cat-adult)
```

### 4.5 USDA Cache

```ts
type UsdaCacheEntry = {
  fdcId: number                 // doc id
  name: string                  // FDC description
  category: string              // FDC foodCategory
  nutrients: NutrientValues     // 우리 키로 매핑된 값
  raw?: unknown                 // 원본 응답 (옵션, 디버깅용)
  fetchedAt: number
}
```

### 4.6 Preset (현행 유지)

```ts
type Preset = {
  id: string                    // 'preset_xxxxxxxx'
  recipeId: string              // 현행 productId 명칭 변경
  code: string                  // 예: 'B0'
  targetWeight: number          // g
  label: string
  unitIngredientId: string
  inputAmount: number
  inputUnitLabel: string
  createdAt: number
}
```

### 4.7 Price (현행 유지)

```ts
type Price = {
  ingredientId: string          // doc id
  unit: number                  // g 기준 단위(예: 100)
  price: number                 // 원
  updatedAt: number
}
```

### 4.8 Firestore 컬렉션

| 컬렉션 | 문서 키 | 비고 |
|---|---|---|
| `recipesssState/{uid}` | uid 단일 문서 | 현행 유지(레시피·원료·발주·단가 통합 state) |
| `nutrientProfiles/{profileId}` | profileId | AAFCO 등 표준. 읽기 전용(코드와 함께 배포). |
| `usdaCache/{fdcId}` | fdcId | USDA 응답 캐시. 쓰기 가능. |
| `recipesssSnapshots/{uid}/items/{snapshotId}` | snapshotId | 변경 전 자동 스냅샷 (현행 localStorage 기반에서 클라우드로 이전) |

Firebase 프로젝트는 **현 recipesss 그대로** (DL-001).

---

## 5. 화면 명세

### 5.1 사이드바 메뉴 트리

```
메인
└─ 대시보드 (/)

레시피
├─ 레시피 작성 (/recipes/new, /recipes/:id)
└─ 레시피 목록 (/recipes)

원료
├─ 원료 마스터 (/ingredients)
└─ USDA 검색 (/ingredients/usda)

계산
└─ 영양 매트릭스 (/calc/:recipeId)   ← MVP 핵심

발주
└─ 발주 프리셋 (/orders)

원가
└─ 단가 관리 (/prices)

출력
├─ PDF 출력 (/print/:recipeId)
└─ 성분 조회 (/lookup)

설정
└─ 백업·복원 (/settings)
```

### 5.2 레시피 입력

현행 레시피 탭 기능 100% 이식 + UI를 운영관리앱 패턴으로.
- 좌측: 종(고양이/강아지/공용) 그룹별 레시피 리스트 (현 사이드바 패턴)
- 우측: 선택한 레시피 카드 (이름·종·composition 행 편집)
- 카드 액션: 닫기 / 복사 / 삭제 (현재 PR 반영)
- 행: 원료명·중량·생산단위 체크·단위명
- 영양제 섹션은 분리된 표

### 5.3 원료 마스터 + USDA 검색

- 원료 리스트 (kind 그룹: 원료/영양제)
- 원료 클릭 → 상세: 이름·치환명·alias·단가·**nutrientProfile 표시**·공급사
- "USDA에서 가져오기" 버튼 → 모달
  - 검색어 입력 → FDC API 호출 → 후보 5~10개 리스트
  - 후보 클릭 → 영양값 미리보기 → "이 원료에 적용" 버튼
  - 결측 영양소는 표시 (수동 입력 가능)

### 5.4 영양 매트릭스 (메인 화면) ★

레시피 1건의 영양 평가.

**상단 컨트롤**:
- 표준 선택: AAFCO (기본, MVP 유일) / NRC / FEDIAF (비활성)
- 기준 단위 토글: per 1000 kcal ME (기본) / DM (g/kg)
- 생산 단위 입력 (현 결과 탭과 동일)

**메인 표**:
| 영양소 | 자견 | 성견 | 자묘 | 성묘 |
|---|---|---|---|---|
| 조단백 | ✓ 28.5 | ✓ 28.5 | ⚠ 22.0/32.0+ (10 부족) | ✓ 28.5 |
| ... | | | | |

- 셀 색: 충족=`bg-green-50 text-green-800` / 부족=`bg-red-50 text-red-700` / 초과=`bg-orange-50 text-orange-700`
- 셀 내용: `값 (필요 / 부족분)` 형식
- 종 한정 제품(`recipe.species`)이면 해당 종 컬럼만 표시
- Ca:P 비율 별도 카드

**하단 종합 판정**:
- 대상별 배지: "완전식이" (Badge success) / "X개 부족" (Badge danger)

### 5.5 원가 계산·발주

현행 결과 탭 + 발주 탭 기능 100% 이식. 디자인만 운영관리앱 패턴으로 재구성.
- 결과 카드: 환산된 행 + 원가 합계
- 발주 프리셋 그리드: 제품별 그룹, 코드 prefix 충돌 방지(현 정책 유지)

### 5.6 PDF 출력

`@react-pdf/renderer`로 클라이언트 생성. A4 portrait.

**양식**:
1. 헤더: 앱명 + 작성일
2. 레시피명·종
3. 배합표 (원료·중량·비율)
4. 영양 매트릭스 요약 (해당 종의 lifestage 2열만)
5. 단가 (총 원가)
6. 푸터: 페이지 번호

폰트: Noto Sans KR Regular/Bold (npm 패키지 또는 public/fonts에 임베드).

### 5.7 성분 조회·이력

- 검색: 제품명·작성일 필터
- 상세 카드: 원료·영양·단가·공급사 한눈에
- 버전 이력 탭: 같은 레시피의 변경 스냅샷 시간순 (현 자동 스냅샷 활용)

---

## 6. 계산 엔진

**원칙**: 모든 계산은 순수 함수. 외부 의존 0. UI는 절대 계산 안 함. Vitest 30+ 케이스 강제.

### 6.1 ME (수정 Atwater) (DL-007)

```ts
function meKcalPer100g(values: NutrientValues): number {
  const p = values.protein ?? 0        // g/100g
  const f = values.fat ?? 0
  const nfe = nfeGPer100g(values)
  return 3.5 * p + 8.5 * f + 3.5 * nfe
}
```

### 6.2 NFE

```ts
function nfeGPer100g(values: NutrientValues): number {
  const dm = 100 - (values.moisture ?? 0)
  const known = (values.protein ?? 0) + (values.fat ?? 0) +
                (values.fiber ?? 0) + (values.ash ?? 0)
  return Math.max(0, dm - known)
}
```

### 6.3 환산

```ts
// 레시피 전체의 영양값 합산 (각 원료 100g 당 → 실제 무게로 비례)
function sumRecipeNutrients(recipe: Recipe, ingredients: IngredientMap): NutrientValues
function totalWeightG(recipe: Recipe): number

// 환산
function per1000kcalME(values: NutrientValues, totalMe: number): NutrientValues
function perKgDryMatter(values: NutrientValues, totalDm: number): NutrientValues
```

### 6.4 부족분 판정

```ts
type AdequacyResult = {
  nutrient: NutrientKey
  actual: number
  min?: number
  max?: number
  status: 'ok' | 'deficient' | 'excess'
  deficit?: number   // status === 'deficient'일 때
  excess?: number    // status === 'excess'일 때
}

function evaluateRecipe(
  recipe: Recipe,
  ingredients: IngredientMap,
  profile: NutrientProfile,
  basis: 'per_1000_kcal_ME' | 'dry_matter'
): AdequacyResult[]

// Ca:P 같은 비율 제약은 별도 판정
function evaluateRatios(
  recipe: Recipe,
  ingredients: IngredientMap,
  profile: NutrientProfile
): RatioResult[]
```

### 6.5 단가 (현행 유지)

```ts
function recipeCost(recipe: Recipe, ingredients: IngredientMap, prices: PriceMap): number
```

---

## 7. 외부 통합

### 7.1 Firebase (DL-001: 현 recipesss 프로젝트)

- **Auth**: 현행 Google OAuth (변경 없음)
- **Firestore**: §4.8 컬렉션 추가
- **Functions**: MVP에서 사용 안 함 (USDA 호출도 클라이언트 직접; 보안 키는 GitHub Secrets→build 시 주입)
- **Storage**: 미사용
- **Hosting**: DL-002 — Firebase Hosting

### 7.2 USDA FoodData Central

- **베이스**: `https://api.nal.usda.gov/fdc/v1`
- **인증**: API key (호두님 발급, env에 `VITE_USDA_API_KEY`)
- **엔드포인트**:
  - 검색: `GET /foods/search?query=...&pageSize=10`
  - 상세: `GET /food/{fdcId}?nutrients=...`
- **레이트 리미트**: 1000 req/hour/key (충분)
- **매핑 테이블**: FDC nutrient ID → recipesss NutrientKey (§4.3)
  - 상수 파일 `src/features/usda/fdcNutrientMap.ts`
- **캐시**: `usdaCache` 컬렉션. 동일 fdcId 재호출 안 함.
- **결측 처리**: 매핑 후 값 없는 영양소는 `null`로 표기 → UI에서 노란 경고 + 수동 입력 가능

### 7.3 PDF (DL-004: @react-pdf/renderer)

- 폰트: Noto Sans KR Regular + Bold (`public/fonts/`)
- 컴포넌트: `src/features/print/RecipePdf.tsx`
- 호출: `pdf(<RecipePdf .../>).toBlob()` → 다운로드 트리거

---

## 8. 데이터 흐름·상태관리

### 8.1 Zustand store 분할

| Store | 책임 |
|---|---|
| `authStore` | 현재 사용자, 인증 상태 |
| `appStore` | UI 전역 상태 (사이드바 open, 현재 라우트 컨텍스트) |
| `recipeStore` | 활성 레시피 편집 상태 (드래프트, 미저장 변경) |
| `toastStore` | 토스트 큐 |

### 8.2 TanStack Query 키 정책

```ts
// 단일 사용자 기반 키 (uid 자동 포함)
['recipes']                    // 전체 리스트
['recipe', recipeId]           // 단건
['ingredients']                // 전체 원료
['ingredient', ingredientId]
['nutrientProfiles']           // 표준 (캐시 staleTime: Infinity)
['nutrientProfile', profileId]
['usdaSearch', query]          // 검색 (캐시 5분)
['usdaFood', fdcId]            // 상세 (캐시 Infinity)
['prices']
['presets']
```

캐시 무효화 정책:
- mutation 후 관련 키 invalidate
- 실시간 동기화는 `onSnapshot` 구독으로 별도 처리 (TanStack Query setQueryData)

### 8.3 폼 검증 (Zod)

레시피·원료·발주 모든 폼은 Zod 스키마 정의 → React Hook Form `zodResolver` 연결.

```ts
// 예시
const RecipeSchema = z.object({
  name: z.string().min(1, '이름 필수'),
  species: z.enum(['cat', 'dog']).nullable(),
  composition: z.array(CompositionRowSchema).min(1),
})
```

---

## 9. 테스트 전략

### 9.1 단위 테스트 (Vitest) — **필수**

대상:
- `src/features/nutrition/*` (계산 엔진) — **최소 30 케이스**
- `src/features/recipes/recipeConversionService.ts`
- `src/features/usda/fdcNutrientMap.ts`
- 모든 Zod 스키마
- `src/lib/utils.ts`

명령: `npm run test`

### 9.2 컴포넌트 테스트 (Testing Library) — **선택적**

대상: 영양 매트릭스 셀 색상 분기 등 시각적 로직만.
페이지 전체는 테스트 안 함 (cost > benefit).

### 9.3 통합·E2E

MVP에서 미사용. 후속 단계 검토.

---

## 10. 운영·배포

### 10.1 환경 분리

| 환경 | URL | Firebase 프로젝트 | 사용 |
|---|---|---|---|
| local | localhost:5173 | (emulator 또는 prod) | 개발 |
| preview | preview-<hash>.web.app | 동일 prod | PR preview (선택) |
| prod | recipesss.web.app (또는 결정) | 현 recipesss | 호두님 실사용 |

### 10.2 Firebase Hosting 타겟

```jsonc
// firebase.json
{
  "hosting": {
    "target": "recipesss",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### 10.3 푸시·머지 정책

- **브랜치**: `main` 단일. PR 없이 직접 push 허용 (1인 개발).
- **커밋 메시지**: 현행 패턴 유지(영문 imperative + Co-Authored-By).
- **각 커밋은 동작해야 함**: 깨진 상태 commit 금지.
- **배포는 명시 명령**: `npm run deploy` 하나로. (auto-deploy 안 함, 의도적 배포 강제)

### 10.4 버전 표기

- `package.json:version` 시맨틱 버전 (MVP 시작 = 1.0.0)
- 앱 헤더(또는 사이드바 푸터)에 `v1.0.0` 표시
- 매 배포마다 commit hash 짧은 형태 같이 표시 (`v1.0.0 · a1b2c3d`)

### 10.5 롤백 절차

```bash
# 1. 직전 배포 hash 확인
git log --oneline -5
# 2. 해당 커밋 체크아웃 후 재배포
git checkout <hash>
npm ci && npm run deploy
git checkout main
```

Firestore 데이터는 **롤백 안 함** (코드만 롤백). 데이터 형식 변경된 경우 마이그레이션 역함수가 미리 있어야 함 → §11.

### 10.6 푸시 시 절차 (체크리스트)

```
[ ] 변경 사항 의도와 SPEC 일치 확인
[ ] npm run typecheck
[ ] npm run lint
[ ] npm run test
[ ] npm run build (dist/ 생성 확인)
[ ] git commit
[ ] git push origin main
[ ] npm run deploy:hosting (의도 시)
[ ] 라이브 URL에서 동작 확인 (강력 새로고침)
```

---

## 11. 마이그레이션 계획

### 11.1 v2 → v3 스키마 변환

v2 상태:
```ts
{ version: 2, products, ingredients, prices, presets, productOrder, orderQuantities, ui, ... }
```

v3 상태:
```ts
{
  version: 3,
  recipes: products로부터 변환,  // id prefix: prod_ → rec_ (또는 그대로 둠)
  ingredients: 그대로 + nutrientProfile 빈 객체로 초기화,
  prices, presets: 그대로
}
```

변환 함수 `migrateV2toV3(state)`. localStorage 그대로 + Firestore에도 적용.

### 11.2 현 데이터 export

```
1. 신규 앱 첫 부팅 시 v2 데이터 자동 감지 (localStorage 'recipe_cost_v2_state')
2. JSON export 다운로드 자동 제공 (안전 백업)
3. migrateV2toV3 실행
4. 신규 키 'recipe_cost_v3_state'로 저장
5. v2 키는 그대로 두기 (롤백 안전망)
```

Firestore의 v2 상태도 동일하게 처리. `recipesssState/{uid}` 문서의 `version` 필드 확인 후 변환.

### 11.3 검증 절차

```
[ ] migrateV2toV3에 v2 테스트 픽스처 입력 → 출력 검증 (Vitest 케이스)
[ ] 실제 호두님 v2 데이터 백업 → 별도 환경에서 변환 시도 → 결과 확인
[ ] 양쪽 비교 (제품 수·원료 수·발주 코드·단가 합계 일치)
[ ] 호두님 OK 받고 prod 적용
```

### 11.4 폴더 이동 (OneDrive → C:\dev\recipesss)

작업 #4 참조. 이 SPEC 승인 후, 단계 0 인프라 시작 직전에 수행.

```
1. 현 OneDrive 폴더의 모든 변경사항 commit + push (작업 중단 시점 확정)
2. PowerShell: Move-Item "C:\Users\oddsk\Downloads\OneDrive\문서\recipesss" "C:\dev\recipesss"
3. Claude Code 재시작 (working dir 변경)
4. git status로 정상 인식 확인
5. (선택) 이후 OneDrive 동기화 영향 0 확인
```

---

## 12. 단계별 일정

각 단계 끝에 **배포 + 호두님 사용 검증 + SPEC §13에 결정 기록**.

### 단계 0: 인프라 (작업 #5)
- Vite/React/TS/Tailwind 골격
- shadcn 컴포넌트 10개 mirror
- AppLayout + 라우터 + 사이드바
- Firebase init
- Vitest 설정
- 첫 배포 (빈 페이지 + 사이드바 동작)
- **완료 기준**: `npm run dev`로 사이드바 메뉴 클릭 시 빈 페이지 전환됨

### 단계 0.5: 데이터·기능 이식 (작업 #6)
- v2 → v3 마이그레이션 (§11)
- 5개 페이지 신규 디자인으로 이식: 레시피 / 단가 / 결과 / 발주 / 출력
- 회귀 테스트: 현 앱과 동일 결과 확인
- **완료 기준**: 호두님이 현 앱 대신 신규 앱 상시 사용 가능

### 단계 1: 영양 엔진 + AAFCO (작업 #7)
- NutrientProfile 스키마 + AAFCO 2024 4종 적재
- Ingredient에 nutrientProfile 수동 입력 UI
- ME/NFE/환산/판정 함수 + 30+ 테스트
- **완료 기준**: 콘솔/테스트로 임의 레시피의 부족분 계산 가능

### 단계 2: USDA 통합 (작업 #8)
- API 키 환경변수
- 검색 모달 + 상세 import
- usdaCache + 수동 보완
- **완료 기준**: 신규 원료 5개 USDA에서 임포트 → 부족분 매트릭스에 즉시 반영

### 단계 3: 매트릭스 화면 (작업 #9)
- 메인 영양 매트릭스 UI
- 표준·기준단위 토글
- 색상·종합 판정
- Ca:P 별도 카드
- **완료 기준**: 호두님 실 레시피 5건에 대해 매트릭스 일치 검증

### 단계 4: PDF 출력 (작업 #10)
- @react-pdf 양식 구현
- Noto Sans KR 임베드
- **완료 기준**: 레시피 1건 PDF 다운로드 가능, 인쇄 시 깨짐 없음

### 단계 5: 성분 조회·이력 (작업 #11)
- 검색·필터
- 버전 이력 탭
- vendor 정보 표시
- **완료 기준**: 과거 변경 이력 시간순 표시 + 특정 시점 복원 가능

---

## 13. 결정 로그

| ID | 날짜 | 결정 | 근거 |
|---|---|---|---|
| DL-001 | 2026-06-03 | Firebase 프로젝트 = 현 recipesss 그대로 | 데이터·Auth 이식 비용 0. 단일 사용자라 통합 이득 없음. |
| DL-002 | 2026-06-03 | 호스팅 = Firebase Hosting | 운영관리앱 동일 패턴, SPA rewrites 표준 지원, 단일 CLI 배포. |
| DL-003 | 2026-06-03 | 디자인 토큰 = `--fp-*` 그대로 mirror (현재 미정의 상태 포함) | 운영관리앱 100% mirror 원칙. 실제 스타일은 `lib/ui.ts` 클래스 상수로. |
| DL-004 | 2026-06-03 | PDF = @react-pdf/renderer | React 친화, 폰트 임베딩 표준, 출력 일관성 보장. |
| DL-005 | 2026-06-03 | 기본 표준 = AAFCO 2024 | 한국 농식품부 참조 + 데이터 입수 용이. NRC/FEDIAF는 스키마 열어두고 MVP 비활성. |
| DL-006 | 2026-06-03 | 대상 = 자견·성견·자묘·성묘 4종 | 핸드오프 §3 그대로. 종 한정 레시피는 열 자동 숨김. |
| DL-007 | 2026-06-03 | ME 식 = 수정 Atwater 3.5/8.5/3.5 고정 | 펫푸드 업계 표준. FEDIAF 예측식은 후속. |
| DL-008 | 2026-06-03 | 기본 기준 단위 = per 1000 kcal ME | AAFCO 표시 관례. DM 토글 제공. |
| DL-009 | 2026-06-03 | 승인 워크플로우·QR 코드 = MVP 제외 | 1인 사용. 후속 PR로 가능. |
| DL-010 | 2026-06-03 | 폴더 위치 = C:\dev\recipesss | OneDrive 동기화 충돌 제거. 개발장 관례. |
| DL-011 | 2026-06-03 | 코드 리포 = github.com/green-cloud-workroom/recipesss 유지 | 기존 리모트 그대로. |

### 결정 변경 절차
1. 변경 사유와 영향 범위를 §13 새 행으로 추가 (이전 행은 두고 superseded 표시)
2. 영향 받는 §1~12 본문 수정
3. 코드 변경
4. 커밋 메시지에 `Refs: DL-NNN` 포함

---

## 부록 A. 작업 트래킹

| 작업 # | 제목 | 의존 |
|---|---|---|
| 1 | 운영관리앱 디자인 시스템 추출 | - |
| 2 | SPEC.md 초안 작성 | #1 |
| 3 | SPEC.md 호두님 검토·수정 | #2 |
| 4 | 폴더 이동 OneDrive→C:\dev | #3 |
| 5 | 단계 0 인프라 | #3, #4 |
| 6 | 단계 0.5 데이터·기능 이식 | #5 |
| 7 | 단계 1 영양 엔진 | #6 |
| 8 | 단계 2 USDA | #7 |
| 9 | 단계 3 매트릭스 UI | #7 |
| 10 | 단계 4 PDF | #9 |
| 11 | 단계 5 조회·이력 | #9 |

## 부록 B. 미해결 사항 (호두님 확인 필요)

다음은 SPEC 본문엔 디폴트로 들어가 있으나 시작 전 명시 확인 받고 싶은 항목.

1. **현 OneDrive 폴더에 미커밋 변경 있는지 확인** — 폴더 이동 전 commit 필수
2. **USDA API 키 발급 여부** — 단계 2 들어가기 전 필요 ([fdc.nal.usda.gov](https://fdc.nal.usda.gov))
3. **AAFCO 2024 표준 표 입수** — 단계 1에서 수동 입력 필요. PDF/공식 자료 호두님이 갖고 계신지?
4. **현 GitHub Pages 도메인 폐기 여부** — recipesss.web.app으로 이전 후 GH Pages는 어떻게? (404? 리다이렉트? 그대로?)
5. **앱 안의 사용자 표기** — 1인이지만 사이드바 푸터에 이메일·역할 표시할지, 아니면 해당 영역 제거할지

---

*문서 끝.*
