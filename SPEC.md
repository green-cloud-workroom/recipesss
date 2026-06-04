# 레시피 계산기 (recipesss) — 통합 SPEC

> 본 문서는 신규 recipesss의 **유일한 진실 공급원(single source of truth)**.
> 구현 결정·UI 디테일·운영 절차 모두 여기에 박는다. 충돌 시 본 문서가 우선.
> 변경은 PR 한 줄짜리라도 §13 결정 로그에 기록.

---

## 0. 메타

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.2 |
| 최종 갱신 | 2026-06-03 |
| 대상 앱 코드명 | recipesss |
| 대상 리포 | github.com/green-cloud-workroom/recipesss |
| **소속 Firebase** | **fant-e5ae5** (운영관리앱·생산관리앱과 공유) |
| 운영관리앱 (디자인 mirror 소스) | `C:\dev\fantapet-inventory` (React/TS) |
| 생산관리앱 (레시피 정식 소유) | `C:\Users\oddsk\Downloads\OneDrive\문서\fant management\fant` (바닐라 JS) |

### 용어
- **레시피(Recipe)**: 1건의 사료 배합. `species`(cat/dog/null) + `composition`(원료 행).
- **드래프트(Draft)**: recipesss에서 작성·임시저장 중인 레시피. `recipeDrafts` 컬렉션에 보관.
- **등록(Registered)**: 드래프트 → 영양제 제외·필드 정규화 → 생산관리앱 공유 `recipes` 컬렉션 승격.
- **원료(Ingredient)**: 마스터에 등록된 1건의 식재료/첨가물. `kind`(ingredient/supplement).
- **영양 프로파일(NutrientProfile)**: 영양소별 min/max 표준 (AAFCO/NRC/FEDIAF).
- **부족분 매트릭스**: 영양소 × 생애주기(자견·성견·자묘·성묘) 표.
- **ME**: 대사에너지(Metabolizable Energy), kcal/100g.
- **NFE**: Nitrogen-Free Extract(탄수화물 추정), DM 기준 g.
- **DM**: 건물(Dry Matter), 수분 제외 무게.
- **lifestage**: `cat-growth`, `cat-adult`, `dog-growth`, `dog-adult` 4종.

### 3개 앱 관계도

```
fant-e5ae5 (Firebase 프로젝트 하나)
├── 운영관리앱 (fantapet-inventory)        디자인 mirror 소스 (단계 0까지만)
│   • React/TS/Vite/Tailwind/shadcn
│   • Firebase Hosting: 별도 타겟
│
├── 생산관리앱 (fant management/fant)       레시피 정식 소유
│   • 바닐라 JS, recipes 컬렉션 write
│   • Firebase Hosting: 별도 타겟
│
└── recipesss (신규)                        본 SPEC 대상
    • React/TS/Vite/Tailwind/shadcn (단계 0까지 운영관리앱 mirror)
    • recipeDrafts 컬렉션 write
    • "등록" 시 recipes 컬렉션으로 승격 (영양제 제외)
    • Firebase Hosting: 별도 타겟
```

---

## 1. 목표·범위·비범위

### 목표
1. 호두님(1인) 펫 사료 레시피 작성·계산·검증·생산앱 등록 통합 도구.
2. **fant-e5ae5에 세 번째 앱**으로 합류. 운영·생산앱과 같은 인증·같은 Firestore.
3. 운영관리앱과 시각적·UX·기술 스택을 **동일하게 시작** (DL-021로 단계 0 끝까지 mirror).
4. 안정성: **스펙 → 구현 → 회귀 테스트** 순서 강제. 즉흥 수정 금지.
5. 단계별 배포 가능: 단계 N 끝나면 항상 동작하는 앱.

### 범위 (MVP에 포함)
- 레시피 작성 = 영양 매트릭스 = 원가 계산 **하나의 화면**으로 통합 (DL-024)
- 원료 추가·중량 조절 시 영양 매트릭스·원가 즉시 갱신
- 임시저장 (`recipeDrafts/`) + 등록 (`recipes/`로 승격, 영양제 자동 제외)
- 원료 마스터에 USDA FoodData Central 영양 데이터 import
- 자견·성견·자묘·성묘 × 영양소 부족분 매트릭스 (AAFCO 기준)
- 발주 프리셋 + 간결한 표시 (예: `(고양이)치킨 a0 20 / a1 40`)
- 레시피 1건 → PDF 출력 2가지 버전
- 레시피 목록 (활성/임시/비활성 상태 필터)
- 표 드래그&드롭으로 행 순서 이동 (DL-022)

### 비범위 (MVP 제외)
- 작성자/승인자 분리, 락(lock), 승인 워크플로우 → 1인 사용이므로 불필요
- QR 코드 생성 → 보류 (필요 시 후속 PR)
- 다국어 → 한국어만
- NRC·FEDIAF 표준 → 스키마는 열어두되 MVP는 AAFCO만 활성화
- 다크 모드 → 라이트만 (운영관리앱과 동일)
- 다중 사용자 권한·role
- 단가 관리(`/prices`) → 메뉴 슬롯은 유지하나 데이터 인터페이스 TBD (생산관리앱에서 불러올 예정, 단계별 일정 외 별도 처리)

---

## 2. 스택·의존성

운영관리앱(`fantapet-inventory`)과 단계 0까지 **버전 단위까지** 일치. 신규 의존성 추가 시 운영관리앱 버전 확인 후 결정.

```jsonc
// 운영관리앱 의존성 mirror + recipesss 신규
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
    "@react-pdf/renderer": "^4.x",      // PDF (DL-004)
    "@dnd-kit/core": "^6.x",            // 표 드래그&드롭 (DL-022)
    "@dnd-kit/sortable": "^8.x",        // 같음
    "@dnd-kit/modifiers": "^7.x"        // 같음
  },
  "devDependencies": {
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
- Node 22 LTS (운영관리앱 Functions와 동일)
- npm 10+

---

## 3. 디자인 시스템

**원칙 (DL-021)**: 운영관리앱(`fantapet-inventory`)과 **단계 0 완료 시점까지만** mirror. 단계 0.5부터는 독립 진행 — 운영관리앱이 변경되어도 recipesss는 따라가지 않음.

### 3.1 Tailwind 토큰 (단계 0 mirror)

운영관리앱 `tailwind.config.ts`를 단계 0에서 그대로 복사.

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

### 3.2 색 토큰 상태 (DL-003 그대로)

운영관리앱의 `--fp-*` CSS 변수는 `tailwind.config.ts`에 선언만 되어 있고 어디에도 정의되어 있지 않음. 실제 스타일은 §3.3의 클래스 상수 사용. recipesss도 동일.

### 3.3 실제 사용 중인 클래스 상수 (운영관리앱 `lib/ui.ts`)

`src/lib/ui.ts`로 완전 복제. 단계 0 이후 자유롭게 확장 가능.

| 상수 | 값 | 용도 |
|---|---|---|
| `PRIMARY_BTN_CLS` | `rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50` | 주 액션 |
| `PRIMARY_BTN_SM_CLS` | `rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50` | 작은 주 |
| `SECONDARY_BTN_CLS` | `rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50` | 보조 |
| `INPUT_CLS` | `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none` | 입력 |
| `CELL_INPUT_CLS` | `w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none` | 표 셀 |
| `INLINE_LINK_CLS` | `text-xs text-blue-600 hover:underline` | 인라인 링크 |
| `INLINE_DANGER_CLS` | `text-xs text-red-400 hover:underline` | 인라인 위험 |
| `CARD_CLS` | `overflow-hidden rounded-lg bg-white shadow-sm` | 카드 |
| `EMPTY_STATE_CLS` | `rounded-lg bg-white p-10 text-center text-sm text-gray-400 shadow-sm` | 빈 상태 |

### 3.4 shadcn 컴포넌트 채택 목록

운영관리앱의 `src/components/ui/` 10개 전부 mirror (변형/props 시그니처 동일):
- `Button` (primary/outline/ghost/danger)
- `Card`, `CardHeader`, `CardContent`
- `Input`, `Textarea`
- `Select`
- `Checkbox`
- `DialogPanel`
- `Badge` (muted/success/danger)
- `Table`
- `Tabs`

### 3.5 레이아웃 패턴

**AppLayout** (운영관리앱 mirror):
- 메인 배경: `bg-gray-50`
- 사이드바: 256px(`w-56`), 흰 배경, 우측 `border-gray-200`, active = `bg-gray-800 text-white`, hover = `bg-gray-100`
- 데스크탑(`md:` 이상): 사이드바 고정 좌측, 메인 우측
- 모바일: 햄버거 헤더 + 슬라이드인 사이드바 (블랙 30% overlay)
- 메인 영역: `flex-1 overflow-auto p-4 md:p-6`
- **사이드바 푸터 (DL-015)**: 이메일 + 로그아웃 버튼만. 역할(role) 표시 없음.

**모달** (`components/common/Modal.tsx`):
- 백드롭: `fixed inset-0 z-50 bg-black/40 p-4`
- 패널: `max-w-md rounded-xl bg-white shadow-xl`
- 헤더(`border-b`) / 본문(`p-5`) / 푸터(`border-t`, 우측 정렬)

**토스트** (`components/common/Toast.tsx`):
- 위치: `fixed right-4 top-4 z-50`
- 톤: success/error/info, 자동 dismiss 3500ms

### 3.6 mirror 종료 시점 (DL-021)

단계 0 완료 시점 이후로는 운영관리앱과 **독립** 진행.
- 단계 0.5부터는 운영관리앱이 어떻게 변경되든 recipesss에 영향 없음.
- 새 shadcn 컴포넌트·새 디자인 토큰·새 레이아웃 패턴은 recipesss 자체 판단으로 추가.
- 운영관리앱 디자인 토큰을 참고만 하고 따라가지 않음.

### 3.7 표 드래그&드롭 패턴 (DL-022)

**디폴트**: 사용자가 직접 수정 가능한 모든 표는 드래그&드롭으로 행 순서 이동 가능.

대상 표:
- 신규 레시피의 원료 행 / 영양제 행
- 원료 마스터 행
- 발주 프리셋 행 (제품 그룹 내 정렬)

**라이브러리**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers`.
- 운영관리앱은 미사용 (운영관리앱 mirror 종료 시점 이후 추가)
- 생산관리앱은 SortableJS 사용. recipesss는 React 표준인 `@dnd-kit`를 채택.

**저장**: 각 행에 `sortOrder` 필드 부여. 드롭 직후 Firestore에 batch update.

---

## 4. 도메인 모델

스키마 버전 v3. v2 → v3 마이그레이션은 §11.

### 4.1 RecipeDraft (recipesss 전용)

```ts
type RecipeDraft = {
  id: string                    // 'draft_xxxxxxxx'
  ownerUid: string              // 호두님 uid
  name: string                  // '치킨'
  species: 'cat' | 'dog' | null
  unitIngredientId: string      // 생산단위 기준 원료
  unitLabel: string             // 예: '마리'
  composition: CompositionRow[]
  standardId: string            // NutrientProfile id (기본: AAFCO_2024_CAT_ADULT 등)
  status: 'draft' | 'inactive'  // inactive = 사용 중단 (목록에서 필터)
  sortOrder: number             // 드래그&드롭 정렬
  createdAt: number
  updatedAt: number
  // 등록 후 추적용
  registeredRecipeId?: string   // recipes/{id} 로 승격된 경우 그 id
  registeredAt?: number
}

type CompositionRow = {
  ingredientId: string
  weight: number                // g 기준 항상
  unit: 'g' | 'kg'              // 표시용
  sortOrder: number             // 드래그&드롭 정렬
}
```

### 4.2 Recipe (생산관리앱 공유 — 등록된 레시피)

생산관리앱의 `recipes/` 컬렉션 스키마를 따른다. **단, 영양제는 없음** (DL-025).

```ts
// 생산관리앱 스키마 매핑 (단계 0.5에서 정확한 필드 셋 작업 #13으로 확정)
type Recipe = {
  id: string
  name: string
  species: 'cat' | 'dog' | null
  composition: Array<{
    ingredientId: string        // meatTypes 또는 자체 원료
    weight: number              // g
    unit: 'g' | 'kg'
  }>
  unitLabel: string             // '마리' 등
  sortOrder: number             // 생산관리앱에서 SortableJS로 관리
  // 생산관리앱 측 추가 필드 (작업 #13에서 확정):
  //   - methodKey?: 'rotary' | 'manual'
  //   - bagId?: string
  //   - conversionHistory 서브컬렉션
  //   - etc
  createdBy: string             // 작성자 uid
  source: 'recipesss' | 'production-app'   // 어느 앱에서 만들었는지
  recipesssDraftId?: string     // recipesss에서 등록한 경우 추적
  createdAt: number
}
```

### 4.3 Ingredient

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
  moistureBasis?: 'as-fed' | 'dry-matter'
  sortOrder: number             // 드래그&드롭 정렬
}
```

### 4.4 NutrientValues

§4.1의 이전 정의 그대로. 일반성분·아미노산·지방산·미네랄·비타민 키 enum.

### 4.5 NutrientProfile (표준)

§4.1의 이전 정의 그대로. MVP는 AAFCO 2024 4종(`AAFCO_2024_DOG_GROWTH`, `_DOG_ADULT`, `_CAT_GROWTH`, `_CAT_ADULT`)만 적재. DL-005 / DL-012.

### 4.6 USDA Cache

§4.5의 이전 정의 그대로. `usdaCache/{fdcId}`.

### 4.7 Preset (현행 유지, draftId 참조)

```ts
type Preset = {
  id: string                    // 'preset_xxxxxxxx'
  draftId: string               // recipeDrafts 참조 (등록 후엔 recipes id로 변경)
  code: string                  // 예: 'A0'
  targetWeight: number          // g
  label: string
  unitIngredientId: string
  inputAmount: number
  inputUnitLabel: string
  sortOrder: number             // 드래그&드롭 정렬
  createdAt: number
}
```

### 4.8 Price (별도 인터페이스 미정 — DL-024)

데이터 위치 결정 보류. 단계 0.5 진행하면서 생산관리앱과 함께 결정.
- 메뉴 슬롯 `/prices`는 유지 (사이드바에 표시)
- 페이지 자체는 "단가 인터페이스 작업 중" placeholder로 시작
- 원료 마스터에는 단가 컬럼 **합치지 않음**

### 4.9 Firestore 컬렉션 (fant-e5ae5 — DL-017, DL-018)

```
fant-e5ae5/
├── recipeDrafts/                          ← recipesss 전용 (신규)
│   └── {uid}/
│       └── items/
│           └── {draftId}                    ← RecipeDraft
│
├── recipes/                                ← 생산관리앱 공유 (기존)
│   └── {recipeId}                           ← Recipe (등록된 것)
│       └── conversionHistory/
│           └── {historyId}
│
├── recipesssIngredients/                   ← recipesss 전용 원료 마스터
│   └── {uid}/
│       └── items/
│           └── {ingredientId}               ← Ingredient
│
├── nutrientProfiles/                       ← 읽기 전용 표준 (recipesss 전용)
│   └── {profileId}                          ← NutrientProfile
│
├── usdaCache/                              ← USDA 응답 캐시
│   └── {fdcId}                              ← UsdaCacheEntry
│
├── recipesssPresets/                       ← 발주 프리셋
│   └── {uid}/
│       └── items/
│           └── {presetId}                   ← Preset
│
├── recipesssSnapshots/                     ← 자동 스냅샷
│   └── {uid}/
│       └── items/
│           └── {snapshotId}
│
└── (기존 운영·생산앱 컬렉션 그대로)
```

**명명 규칙**:
- recipesss 전용 컬렉션은 `recipesss*` 접두 또는 `recipeDrafts` 같은 명확한 의미.
- 공유 컬렉션 (`recipes`, `nutrientProfiles`, `usdaCache`)은 접두 없이.
- Firestore Rules는 컬렉션별 권한 명시.

**Firestore Rules 정책 (단계 0에서 PR로 제출)**:
- `recipeDrafts/{uid}/**`: 본인 read/write
- `recipes/**`: 인증 사용자 read, write는 작성자 본인만 또는 admin
- `recipesss*/{uid}/**`: 본인 read/write
- `nutrientProfiles/**`: 인증 사용자 read만
- `usdaCache/**`: 인증 사용자 read/write

---

## 5. 화면 명세

### 5.1 사이드바 메뉴 트리 (DL-024 — 재정의)

```
메인
└─ 대시보드 (/)

레시피
├─ 신규 레시피 (/recipes/new)            ← 단일 화면 메인
└─ 레시피 목록 (/recipes)                ← 상태 필터 (활성/임시/비활성)
                                            영양제 제외 후 생산관리앱 푸시(등록)

원료
└─ 원료 마스터 (/ingredients)           ← USDA 검색은 모달로 내장

발주
├─ 발주 프리셋 (/orders)                 ← 프리셋 설정·발주 한 페이지에서
└─ PDF 출력 (/print/:recipeId)           ← 출력 1·2 두 버전

원가
└─ 단가 관리 (/prices)                   ← 인터페이스 미정 placeholder

설정
└─ 백업·복원 (/settings)
```

### 5.2 신규 레시피 (`/recipes/new`, `/recipes/draft/:draftId` 편집)

**메인 화면. 영양 매트릭스 + 레시피 작성 + 원가 계산을 한 화면에 통합.**

레이아웃:
```
[상단] 레시피명·종 선택·생산 단위 입력
[중단 좌] 원료 행 표 (드래그&드롭, +원료 추가 버튼)
         영양제 행 표 (드래그&드롭, +영양제 추가 버튼)
[중단 우] 영양 매트릭스 (자견·성견·자묘·성묘 × 영양소)
         즉시 갱신. 부족·초과 색상 표시.
[하단]   Ca:P 비율 카드 · 종합 판정 배지 · 원가 합계
[액션]   임시저장 (recipeDrafts 갱신) · 등록 (recipes로 승격, 영양제 제외)
```

**원료 추가 흐름**:
- 표 행 `+ 원료 추가` 클릭 → 검색 모달 → 원료 마스터 후보 리스트 + "USDA에서 가져오기" 버튼
- 선택 시 행 추가. 중량 입력. 즉시 매트릭스 갱신.

**임시저장**:
- 자동 저장 (3초 디바운스) + 명시적 "임시저장" 버튼
- `recipeDrafts/{uid}/items/{draftId}` 갱신

**등록 (DL-025)**:
- "이 레시피 등록" 버튼 → 확인 모달 → 변환 함수 실행 → `recipes/{recipeId}` 생성
- 변환 시 영양제 행 자동 제외, 필드 정규화(`name`/`species`/`composition`/`unitLabel`만 push)
- 등록 후 드래프트에 `registeredRecipeId`·`registeredAt` 기록 (드래프트는 남김; 수정용)

### 5.3 레시피 목록 (`/recipes`)

- 상단 필터: 상태 (활성/임시/비활성), 종, 검색
- 좌측 사이드: 종별 그룹 카운트
- 메인: 카드 또는 표 (드래그&드롭 정렬)
- 액션:
  - 행 클릭 → 신규 레시피 편집 화면
  - "생산관리로 푸시" 일괄 액션 (체크박스 다중 선택 → 푸시) — DL-025 변환 함수 적용
  - 상태 토글 (활성 ↔ 비활성)
  - 복제 (현 `복사` 기능 그대로)
  - 삭제

### 5.4 원료 마스터 + USDA 검색 (`/ingredients`)

- 원료 리스트 (kind 그룹: 원료/영양제) — 드래그&드롭 정렬
- 원료 클릭 → 상세 패널: 이름·치환명·alias·**nutrientProfile 표시**·공급사
- 단가 컬럼은 없음 (DL-024)
- "USDA에서 가져오기" 버튼 → 모달:
  - 검색어 입력 → FDC API 호출 → 후보 5~10개
  - 후보 클릭 → 영양값 미리보기 → "이 원료에 적용" 또는 "신규 원료로 추가"
  - 결측 영양소는 표시 (수동 입력 가능)
- 별도 `/ingredients/usda` 페이지 없음. 원료 마스터 안 모달에서 처리.

### 5.5 발주 프리셋 (`/orders`) — 간결 표시

- 프리셋 설정과 발주 한 페이지에서 처리
- 표시 양식: 제품 그룹별로 한 줄 한 줄 짧게
  ```
  (고양이)치킨    a0 20개   a1 40개   a2 60개   [+ 프리셋 추가]
  (고양이)본치킨  b0 100g   b1 200g   [+ 프리셋 추가]
  (강아지)덕      c0 1마리  c1 2마리  [+ 프리셋 추가]
  ```
- 드래그&드롭으로 프리셋 행 순서·그룹 내 정렬
- 발주 수량 입력 (현행 유지)
- 출력 미리보기 생성 → `/print/:recipeId`

### 5.6 PDF 출력 (`/print/:recipeId`) — 출력 1·2 두 버전

`@react-pdf/renderer` 사용. A4 portrait.

**출력 1**: 현 recipesss "출력 1" 양식 (난각분만 표)
**출력 2**: 현 recipesss "출력 2" 양식 (영양제 그룹별 표)

두 버전 모두 폰트 Noto Sans KR Regular/Bold 임베드.

### 5.7 단가 관리 (`/prices`)

플레이스홀더 페이지. "생산관리앱과 통합 작업 중" 안내. 인터페이스 결정 후 구현.

### 5.8 백업·복원 (`/settings`)

- 현재 상태 JSON export (recipeDrafts + 원료 + 프리셋)
- JSON 업로드 → 마이그레이션 + 적용
- 자동 스냅샷 목록 (recipesssSnapshots/) → 시점 복원

---

## 6. 계산 엔진

**원칙**: 모든 계산은 순수 함수. 외부 의존 0. UI는 절대 계산 안 함. Vitest 30+ 케이스 강제.

### 6.1 ME (수정 Atwater) — DL-007

```ts
function meKcalPer100g(values: NutrientValues): number {
  const p = values.protein ?? 0
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
function sumRecipeNutrients(draft: RecipeDraft, ingredients: IngredientMap): NutrientValues
function totalWeightG(draft: RecipeDraft): number
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
  deficit?: number
  excess?: number
}

function evaluateDraft(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile,
  basis: 'per_1000_kcal_ME' | 'dry_matter'
): AdequacyResult[]

function evaluateRatios(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  profile: NutrientProfile
): RatioResult[]
```

### 6.5 등록 시 영양제 제외 변환 (DL-025)

```ts
// recipeDrafts → recipes 변환. 영양제 제외 + 필드 정규화.
function draftToRecipe(
  draft: RecipeDraft,
  ingredients: IngredientMap,
  ownerUid: string
): Omit<Recipe, 'id' | 'createdAt'> {
  const ingredientRows = draft.composition.filter(row => {
    const ing = ingredients[row.ingredientId]
    return ing && ing.kind === 'ingredient'   // supplement 제외
  })
  return {
    name: draft.name,
    species: draft.species,
    composition: ingredientRows.map(({ ingredientId, weight, unit }) => ({
      ingredientId, weight, unit
    })),
    unitLabel: draft.unitLabel,
    sortOrder: 0,            // 생산관리앱에서 재정렬
    createdBy: ownerUid,
    source: 'recipesss',
    recipesssDraftId: draft.id,
  }
}
```

---

## 7. 외부 통합

### 7.1 Firebase (DL-017: fant-e5ae5)

- **Auth**: fant-e5ae5의 Google OAuth (운영관리앱·생산관리앱과 공유). 호두님은 같은 Google 계정으로 인증.
- **Firestore**: §4.9 컬렉션. 신규 컬렉션은 단계 0.5에서 Firestore Rules PR로 제출.
- **Functions**: MVP에서 사용 안 함.
- **Storage**: 미사용.
- **Hosting**: §10 — `hosting:recipesss` 타겟 (운영·생산앱 옆 세 번째 사이트).

### 7.2 USDA FoodData Central

- 베이스: `https://api.nal.usda.gov/fdc/v1`
- 인증: API key (`VITE_USDA_API_KEY`)
- 검색: `GET /foods/search?query=...&pageSize=10`
- 상세: `GET /food/{fdcId}?nutrients=...`
- 매핑 테이블: FDC nutrient ID → recipesss NutrientKey (`src/features/usda/fdcNutrientMap.ts`)
- 캐시: `usdaCache/{fdcId}` Firestore 컬렉션 (동일 fdcId 재호출 안 함)
- 결측 처리: 매핑 후 값 없는 영양소는 `null` → UI 노란 경고 + 수동 입력 가능

### 7.3 PDF (@react-pdf/renderer — DL-004)

- 폰트: Noto Sans KR Regular + Bold (`public/fonts/`)
- 컴포넌트: `src/features/print/RecipePdf1.tsx` (출력 1), `RecipePdf2.tsx` (출력 2)
- 호출: `pdf(<RecipePdf1 .../>).toBlob()` → 다운로드 트리거

### 7.4 생산관리앱 푸시 (DL-025)

**메커니즘**: 같은 fant-e5ae5 Firebase 프로젝트 내 다른 컬렉션 쓰기. Firestore 직접 write.

**액션 흐름**:
```
1. 사용자가 레시피 목록에서 1개 이상 선택 → "생산관리로 푸시" 클릭
2. 확인 모달: "N개 레시피를 생산관리앱에 등록합니다. 영양제는 자동 제외됩니다."
3. 각 드래프트에 draftToRecipe() 적용 → recipes/{newId} 신규 생성
4. 드래프트에 registeredRecipeId·registeredAt 기록
5. 토스트: "N개 등록 완료. 생산관리앱에서 확인 가능."
```

**중복 방지**:
- 이미 등록된 드래프트(`registeredRecipeId` 존재)는 "이미 등록됨" 표시
- 재등록 옵션 (덮어쓰기 또는 새 ID 부여) 후속 PR

**롤백**:
- 등록 직후 N초 안에 "취소" 가능 (Toast 안에 취소 버튼) — 후속 PR
- 그 후엔 생산관리앱 측에서 삭제 요청

**권한**:
- recipes 컬렉션 write는 작성자 본인만 (Firestore Rules)
- recipesss·생산관리앱·운영관리앱 모두 fant-e5ae5의 같은 Auth 사용

---

## 8. 데이터 흐름·상태관리

### 8.1 Zustand store 분할

| Store | 책임 |
|---|---|
| `authStore` | 현재 사용자, fant-e5ae5 인증 상태 |
| `appStore` | UI 전역 상태 (사이드바 open) |
| `draftEditorStore` | 활성 드래프트 편집 상태 (미저장 변경 추적) |
| `toastStore` | 토스트 큐 |

### 8.2 TanStack Query 키 정책

```ts
// uid 자동 포함
['recipeDrafts']                       // 호두님 드래프트 전체
['recipeDraft', draftId]
['recipes']                            // 등록된 레시피 (공유)
['recipe', recipeId]
['recipesssIngredients']               // 원료 마스터
['ingredient', ingredientId]
['nutrientProfiles']                   // (staleTime: Infinity)
['nutrientProfile', profileId]
['usdaSearch', query]                  // (staleTime: 5분)
['usdaFood', fdcId]                    // (staleTime: Infinity)
['recipesssPresets']
['recipesssSnapshots']
```

캐시 무효화: mutation 후 관련 키 invalidate. 실시간 동기화는 `onSnapshot` + `queryClient.setQueryData`.

### 8.3 폼 검증 (Zod)

모든 폼은 Zod 스키마 정의 → React Hook Form `zodResolver` 연결.

```ts
const RecipeDraftSchema = z.object({
  name: z.string().min(1, '이름 필수'),
  species: z.enum(['cat', 'dog']).nullable(),
  composition: z.array(CompositionRowSchema).min(1),
  standardId: z.string().min(1),
})
```

---

## 9. 테스트 전략

### 9.1 단위 테스트 (Vitest) — 필수

대상:
- `src/features/nutrition/*` — 최소 30 케이스
- `src/features/recipes/draftToRecipe.ts` — 변환 함수 (영양제 제외 검증) — 최소 10 케이스
- `src/features/usda/fdcNutrientMap.ts`
- 모든 Zod 스키마
- `src/lib/utils.ts`

명령: `npm run test`

### 9.2 컴포넌트 테스트 (Testing Library) — 선택적

대상: 영양 매트릭스 셀 색상 분기, 푸시 액션 모달 등 시각·상호작용 로직.
페이지 전체는 테스트 안 함.

### 9.3 통합·E2E

MVP에서 미사용.

---

## 10. 운영·배포

### 10.1 환경 분리

| 환경 | URL | Firebase | 사용 |
|---|---|---|---|
| local | localhost:5173 | (emulator 또는 prod) | 개발 |
| prod | recipesss-app.web.app (또는 결정) | fant-e5ae5 | 호두님 실사용 |

### 10.2 Firebase Hosting 타겟

```jsonc
// firebase.json (recipesss 리포)
{
  "hosting": {
    "target": "recipesss",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

`.firebaserc`에 `target` 매핑 추가:
```jsonc
{
  "projects": { "default": "fant-e5ae5" },
  "targets": {
    "fant-e5ae5": {
      "hosting": {
        "recipesss": ["recipesss-app"]   // ← Firebase Console에서 사이트 생성 후 ID
      }
    }
  }
}
```

### 10.3 푸시·머지 정책

- 브랜치: `main` 단일. PR 없이 직접 push 허용 (1인 개발).
- 커밋 메시지: 영문 imperative + Co-Authored-By.
- 각 커밋은 동작해야 함. 깨진 상태 commit 금지.
- 배포는 명시 명령: `npm run deploy`. auto-deploy 안 함.

### 10.4 버전 표기

- `package.json:version` 시맨틱 버전 (MVP 시작 = 1.0.0)
- 사이드바 푸터에 `v1.0.0 · a1b2c3d` 표시 (Vite build 시 commit hash 주입)

### 10.5 GitHub Pages 비활 시점 (DL-020)

```
1. 단계 0.5 완료 — 신규 앱이 fant-e5ae5 Hosting에서 정상 동작 확인
2. 호두님이 신규 URL로 며칠 사용 후 OK
3. GitHub 리포 Settings → Pages → Source: None → 비활성화
4. 구 URL (green-cloud-workroom.github.io/recipesss/) 404
5. 아이폰 PWA 아이콘 신규 URL로 재설치
```

### 10.6 푸시 체크리스트

```
[ ] 변경 사항 의도와 SPEC 일치 확인
[ ] npm run typecheck
[ ] npm run lint
[ ] npm run test
[ ] npm run build
[ ] git commit
[ ] git push origin main
[ ] npm run deploy:hosting (의도 시)
[ ] 라이브 URL에서 동작 확인 (강력 새로고침)
```

### 10.7 롤백

```bash
git log --oneline -5
git checkout <prev-hash>
npm ci && npm run deploy
git checkout main
```

데이터는 §11.5 안전망. 스키마 변경된 경우 마이그레이션 역함수 미리 준비.

---

## 11. 마이그레이션 계획

### 11.1 v2 → v3 스키마 변환

v2 상태 (현 recipesss):
```ts
{ version: 2, products, ingredients, prices, presets, productOrder, orderQuantities, ui, ... }
```

v3 상태 (신규):
```ts
{
  version: 3,
  recipeDrafts: products → recipeDrafts 변환 (모두 status: 'draft'),
  ingredients: 그대로 + nutrientProfile 빈 객체로 초기화 + sortOrder 부여,
  presets: 그대로 + sortOrder 부여,
  prices: 별도 처리 (DL-024)
}
```

변환 함수 `migrateV2toV3(state)`. 순수 함수 + Vitest.

### 11.2 데이터 이전 (구 recipesss Firebase → fant-e5ae5)

작업 #14 참조.

**절차**:
```
1. 현 recipesss Firebase 'recipe_cost_v2_state' 또는 Firestore recipesssState/{uid} 읽기
2. migrateV2toV3() 적용
3. fant-e5ae5의 다음 컬렉션에 write:
   - recipeDrafts/{uid}/items/{draftId}
   - recipesssIngredients/{uid}/items/{ingredientId}
   - recipesssPresets/{uid}/items/{presetId}
4. 양쪽 비교 검증:
   - 레시피 수 일치
   - 원료 수 일치
   - 발주 코드·단가 합계 일치
5. 호두님 OK 후 prod 적용
```

Node.js 스크립트 (`scripts/migrate-to-fant-e5ae5.ts`) 1회 실행.

### 11.3 폴더 이동 (OneDrive → C:\dev\recipesss)

작업 #4 참조.

```
1. 현 OneDrive 폴더의 모든 변경사항 commit + push 확인
2. PowerShell: Move-Item "C:\Users\oddsk\Downloads\OneDrive\문서\recipesss" "C:\dev\recipesss"
3. Claude Code 재시작 (working dir 변경)
4. git status로 정상 인식 확인
```

**※ 생산관리앱 (`fant management/fant`)도 OneDrive에 있음**. 별도 작업으로 옮길지는 호두님 결정.

### 11.4 데이터 안전 정책 (DL-014)

3중 안전망:
1. **브라우저 localStorage** — 호두님 기기 (오프라인 동작)
2. **Firebase Firestore** — 클라우드 (구 recipesss + fant-e5ae5 양쪽 다)
3. **리포 `backups/` 디렉토리** — 큰 작업 직전 JSON 스냅샷

**원칙**:
- 호스팅·코드 변경은 데이터에 0 영향
- 큰 작업 직전 `backups/<YYYY-MM-DD>-<사유>.json` 추가 후 commit
- 마이그레이션 함수는 순수 함수 + Vitest 회귀

### 11.5 구 recipesss Firebase 처리 (DL-019)

마이그레이션 후:
- 구 프로젝트는 **그대로 두고 읽기 전용**
- 몇 달 동안 신규 앱이 안정적인지 확인
- 완전 판단 명확하면 그 때 삭제

### 11.6 GitHub Pages 비활 절차

§10.5 참조.

---

## 12. 단계별 일정

각 단계 끝에 **배포 + 호두님 검증 + SPEC §13 결정 기록**.

### 단계 0: 인프라 (작업 #5)
- Vite/React/TS/Tailwind 골격
- shadcn 컴포넌트 10개 mirror (운영관리앱)
- `lib/ui.ts` 클래스 상수 mirror
- AppLayout + 라우터 + 사이드바 (DL-024 메뉴 트리)
- Firebase init (fant-e5ae5)
- Vitest 설정
- `@dnd-kit/*` 의존성 추가 (DL-022)
- 첫 배포 (빈 페이지 + 사이드바 동작)
- **mirror 종료 시점** (DL-021) — 이후 운영관리앱 독립 진행
- **완료 기준**: 사이드바 메뉴 클릭 시 빈 페이지 전환됨. fant-e5ae5 Hosting에 배포 완료.

### 단계 0.5: 데이터·기능 이식 (작업 #6 + #14)
- v2 → v3 마이그레이션 함수 + Vitest
- 데이터 이전 스크립트 (구 → fant-e5ae5)
- 5개 페이지 신규 디자인으로 이식: 신규 레시피·레시피 목록·원료 마스터·발주·PDF 출력
- 영양 매트릭스는 단계 1에서, 단계 0.5에선 placeholder
- 회귀 테스트: 현 앱과 동일 결과 확인
- **GitHub Pages 비활** (DL-020)
- **완료 기준**: 호두님이 현 앱 대신 신규 앱 상시 사용. 데이터 손실 0.

### 단계 1: 영양 엔진 + AAFCO (작업 #7 + #12)
- NutrientProfile 스키마 + AAFCO 2024 4종 적재
- Ingredient에 nutrientProfile 수동 입력 UI
- ME/NFE/환산/판정 함수 + 30+ 테스트
- 신규 레시피 화면에 영양 매트릭스 통합 (단계 0.5 placeholder 대체)
- **완료 기준**: 호두님 레시피 5건에 대해 매트릭스 일치 검증

### 단계 2: USDA 통합 (작업 #8)
- API 키 환경변수
- 검색 모달 (원료 마스터 내장)
- usdaCache + 결측 보완
- **완료 기준**: 신규 원료 5개 USDA import → 매트릭스 즉시 반영

### 단계 3: 푸시 + 매트릭스 보강 (작업 #9 + #13)
- 생산관리앱 recipes 스키마 정확히 파악 (작업 #13)
- draftToRecipe 변환 함수 + Vitest
- 레시피 목록에 "생산관리로 푸시" 액션
- 매트릭스 보강 (표준 토글·기준단위 토글·종합 판정 배지)
- **완료 기준**: 드래프트 1건 등록 → 생산관리앱에서 보임

### 단계 4: PDF 출력 (작업 #10)
- @react-pdf 출력 1·2 두 양식
- Noto Sans KR 임베드
- **완료 기준**: 두 양식 다운로드. 인쇄 깨짐 없음.

### 단계 5: 마무리 (작업 #11)
- 백업·복원 페이지
- 단가 인터페이스 결정 (생산관리앱과 협의)
- 자잘한 UX 다듬기

---

## 13. 결정 로그

| ID | 날짜 | 결정 | 근거 |
|---|---|---|---|
| ~~DL-001~~ | 2026-06-03 | ~~Firebase 프로젝트 = 현 recipesss 그대로~~ | **DL-017로 supersede.** |
| DL-002 | 2026-06-03 | 호스팅 = Firebase Hosting | 운영관리앱 동일 패턴, SPA rewrites 표준 지원. |
| DL-003 | 2026-06-03 | 디자인 토큰 = `--fp-*` 그대로 mirror (미정의 상태 포함) | 운영관리앱 mirror. 실제 스타일은 `lib/ui.ts`. |
| DL-004 | 2026-06-03 | PDF = `@react-pdf/renderer` | React 친화, 폰트 임베딩 표준. |
| DL-005 | 2026-06-03 | 기본 표준 = AAFCO 2024 | 한국 농식품부 참조. NRC/FEDIAF는 스키마만. |
| DL-006 | 2026-06-03 | 대상 = 자견·성견·자묘·성묘 4종 | 핸드오프 §3 그대로. 종 한정 시 열 자동 숨김. |
| DL-007 | 2026-06-03 | ME 식 = 수정 Atwater 3.5/8.5/3.5 고정 | 펫푸드 업계 표준. |
| DL-008 | 2026-06-03 | 기본 기준 단위 = per 1000 kcal ME | AAFCO 표시 관례. DM 토글. |
| DL-009 | 2026-06-03 | 승인 워크플로우·QR = MVP 제외 | 1인 사용. |
| DL-010 | 2026-06-03 | 폴더 위치 = C:\dev\recipesss | OneDrive 동기화 충돌 제거. |
| DL-011 | 2026-06-03 | 코드 리포 = github.com/green-cloud-workroom/recipesss 유지 | 기존 리모트 그대로. |
| DL-012 | 2026-06-03 | AAFCO 표준 표 = 단계 1 직전 클로드가 공식 자료로 수동 입력 | 호두님 미보유. |
| DL-013 | 2026-06-03 | GitHub Pages = 완전 제거 | 혼동 소지 제거. |
| DL-014 | 2026-06-03 | 데이터 안전 정책 = localStorage·Firestore·`backups/` 3중 | 호스팅 변경과 무관 보호. |
| DL-015 | 2026-06-03 | 사이드바 푸터 = 이메일 + 로그아웃만 | 1인 사용. |
| DL-016 | 2026-06-03 | USDA API 키 = 단계 2 직전 호두님 본인 발급 | 외부 서비스 본인 책임. |
| **DL-017** | 2026-06-03 | **recipesss = fant-e5ae5 Firebase 통합 (DL-001 supersede)** | 생산관리앱 푸시·운영관리앱 mirror 모두 같은 프로젝트라 자연스러움. |
| **DL-018** | 2026-06-03 | **컬렉션 = recipeDrafts(작성·임시) + recipes(등록·생산앱 공유)** | 권한·UX 명확. 등록 = 영양제 제외 후 recipes로 승격. |
| **DL-019** | 2026-06-03 | **구 recipesss Firebase = 마이그레이션 후 읽기 전용 유지** | 안전한 롤백 안전망. 몇 달 후 판단. |
| **DL-020** | 2026-06-03 | **GitHub Pages 비활 = 단계 0.5 끝·신규 앱 정상 확인 후** | 데이터 영향 0. 신규 앱 검증 후 정리. |
| **DL-021** | 2026-06-03 | **운영관리앱 mirror 종료 = 단계 0 끝까지만** | 디자인 토큰·shadcn·레이아웃·`lib/ui.ts`까지. 이후 독립. |
| **DL-022** | 2026-06-03 | **표 드래그&드롭 디폴트 = `@dnd-kit/sortable`** | React 표준. 생산관리앱은 SortableJS이나 recipesss는 React 패턴. |
| **DL-023** | 2026-06-03 | **Claude=아키텍트, Codex=구현 협업 (fantapet CLAUDE.md 패턴 채택)** | 검증된 패턴. docs/Codex지시서_*.md로 단계별 핸드오프. |
| **DL-024** | 2026-06-03 | **메뉴 트리 재정의 (영양 매트릭스+레시피 작성 통합, /lookup 제거, /prices 별도)** | 호두님 의도 반영. 신규 레시피 = 입력·계산·등록 한 화면. |
| **DL-025** | 2026-06-03 | **푸시 = 영양제 제외 + 이름·종·composition·unitLabel만 → recipes/에 신규 생성** | 생산관리앱은 영양제 안 다룸. 최소 필드. |

### 결정 변경 절차
1. 변경 사유와 영향 범위를 §13 새 행으로 추가. 이전 행은 두고 ~~취소선~~ + supersede.
2. 영향 받는 §1~12 본문 수정.
3. 코드 변경 (커밋 메시지에 `Refs: DL-NNN`).

---

## 부록 A. 작업 트래킹

| # | 제목 | 의존 |
|---|---|---|
| 1 | 운영관리앱 디자인 시스템 추출 | - |
| 2 | SPEC.md 초안 작성 | #1 |
| 3 | SPEC.md 호두님 검토·수정 | #2 |
| 4 | 폴더 이동 OneDrive→C:\dev\recipesss | #3 |
| 5 | 단계 0 인프라 (Vite/React/TS/Tailwind/shadcn) | #3, #4 |
| 6 | 단계 0.5 데이터·기능 이식 | #5 |
| 7 | 단계 1 영양 엔진 + AAFCO | #6 |
| 8 | 단계 2 USDA 통합 | #7 |
| 9 | 단계 3 부족분 매트릭스 + 푸시 | #7 |
| 10 | 단계 4 PDF 출력 | #9 |
| 11 | 단계 5 마무리 | #9 |
| 12 | CLAUDE.md 작성 | #3 |
| 13 | 생산관리앱 recipes 스키마 파악 | #3 |
| 14 | 구 recipesss → fant-e5ae5 마이그레이션 스크립트 | #5 |

## 부록 B. 미해결 사항

해결 완료 → §13 결정 로그로 이관:
- ~~AAFCO 자료 입수~~ → DL-012
- ~~USDA API 키~~ → DL-016
- ~~GitHub Pages 처리~~ → DL-013, DL-020
- ~~사이드바 푸터~~ → DL-015
- ~~Firebase 프로젝트~~ → DL-017
- ~~컬렉션 구조~~ → DL-018
- ~~구 프로젝트 처리~~ → DL-019
- ~~mirror 종료 시점~~ → DL-021
- ~~표 드래그&드롭~~ → DL-022
- ~~코덱스 협업 패턴~~ → DL-023
- ~~메뉴 재정의~~ → DL-024
- ~~푸시 인터페이스~~ → DL-025

남은 미해결:
- 단가 인터페이스 (DL-024 placeholder, 단계 5에서 결정)
- 생산관리앱 recipes 스키마 상세 (작업 #13에서 확정)

---

*문서 끝.*
