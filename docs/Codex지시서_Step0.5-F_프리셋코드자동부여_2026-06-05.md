# Codex 지시서 — Step 0.5-F: 프리셋 코드 자동 부여 (`/presets`)

> 작성: Claude (아키텍트) · 2026-06-05 · 구현: Codex
> 정본: **SPEC.md §5.5**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 0.5-D에서 만든 프리셋 설정 화면(`/presets`)의 후속. 현재 프리셋 코드(`code`, 예: `A0`·`B6`)는 **사용자가 직접 입력**한다. SPEC §5.5는 "코드(자동 부여)"를 요구한다 — 이걸 채운다.
- v2에 원본 로직이 있다: `archive/old/v2-source/modules/preset-codes.js`. 이미 분석했다. v3 모델에 맞게 **순수 함수로 포팅**한다 (v2는 product/productId/productOrder, v3는 draft/draftId/draft.sortOrder).
- 코드 형식: `^([A-Z])(\d+)$` — **대문자 1글자(prefix) + 숫자(suffix)**. 예: `A0`, `B6`. (backups 데이터도 전부 이 형식: `L0`/`N3`/`R3`…)
- **이번 범위는 "신규 추가 시 자동 부여"까지.** 기존 코드 일괄 충돌 정규화(v2 `computeNormalizedPresets`)는 기존 데이터를 대량 변경(Firestore write 多)하므로 **제외**(아래 OUT). 드래그&드롭 정렬도 **별도 지시서(0.5-G)**.

## 1. 목표·범위

### IN (이번에 구현)

1. 순수 함수 `presetCodes.ts`: 코드 파싱 + draft별 prefix 결정 + 빈 suffix 결정 + 코드 생성.
2. `/presets` "프리셋 추가" 모달을 열 때 **code 필드에 자동 생성값을 기본으로 채운다.** 사용자가 그대로 두거나 수정 가능.
3. 편집 모달은 **기존 code 유지**(자동 부여 안 함).

### OUT (이번에 만들지 말 것)

- ❌ **기존 프리셋 일괄 정규화/충돌 해소** (v2 `computeNormalizedPresets`). 기존 100개 코드를 대량 변경 → write 폭증 + 사용자 익숙한 코드 변경이라 위험. 별도 결정 필요.
- ❌ **드래그&드롭 정렬** (@dnd-kit) — 0.5-G에서. 이번엔 손대지 말 것.
- ❌ 코드 중복에 대한 강제 차단/검증 UI. 자동값은 빈 번호를 고르므로 기본적으로 안 겹치지만, 사용자가 수동으로 겹치게 입력하는 것까지 막지 않는다(현 동작 유지).

## 2. 먼저 읽을 것

- `archive/old/v2-source/modules/preset-codes.js` — 원본 로직 (parseCode / pickPresetPrefix / pickPresetSuffix / generatePresetCode). **포팅 대상**. (단, `computeNormalizedPresets`는 포팅하지 말 것 — 범위 밖)
- `SPEC.md` §5.5 (프리셋 설정 — "코드(자동 부여)")
- `src/types/recipe.ts` — `Preset`(code·draftId·sortOrder…), `RecipeDraft`(id·sortOrder)
- `src/features/presets/presetSelectors.ts` — 순수 함수 패턴 + 테스트(`presetSelectors.test.ts`)
- `src/pages/PresetsPage.tsx` — `defaultFormValues`, `PresetFormModal`, `handleSave` 흐름

## 3. 구현 단위

### 3-1. `src/features/presets/presetCodes.ts` (신규) — 순수 함수 ★

> v2 `preset-codes.js`의 v3 포팅. React/Firebase import 금지. v2의 `state.presets`(맵)·`productId`·`productOrder`를 → v3의 `Preset[]`·`draftId`·`drafts`(sortOrder 정렬)로 바꾼다.

```ts
import type { Preset, RecipeDraft } from '../../types/recipe'

const CODE_RE = /^([A-Z])(\d+)$/

export type ParsedCode = { prefix: string; suffix: number }

export function parseCode(code: string): ParsedCode | null {
  const match = CODE_RE.exec(code ?? '')
  if (!match) return null
  const prefix = match[1]
  const suffixRaw = match[2]
  // noUncheckedIndexedAccess: 그룹이 undefined일 수 있어 명시 체크
  if (prefix === undefined || suffixRaw === undefined) return null
  return { prefix, suffix: Number.parseInt(suffixRaw, 10) }
}

// 이 draft가 "원래 쓰던" prefix 추정 — 가장 많이 쓰인 글자, 동률은 첫 등장.
export function preferredPrefixOfDraft(presets: Preset[], draftId: string): string {
  // v2 preferredPrefixOfProduct 포팅: draftId 일치하는 preset.code 파싱 → prefix 빈도 집계
  // 없으면 '' 반환
}

// 새 preset에 부여할 prefix.
// 우선순위: 이 draft가 이미 쓰던 prefix → draft 정렬 인덱스 글자 → 사용 가능한 첫 글자 → 'P'
export function pickPrefix(
  presets: Preset[],
  drafts: RecipeDraft[],
  draftId: string,
): string {
  // 1) own = preferredPrefixOfDraft(presets, draftId); own이 있으면 반환
  // 2) taken = 다른 draft들이 쓰는 prefix 집합 (preset.draftId !== draftId 인 것들의 prefix)
  // 3) drafts 를 sortOrder 오름차순 정렬한 배열에서 draftId 의 인덱스 idx.
  //    0 <= idx < 26 이고 글자(String.fromCharCode(65+idx))가 taken 아니면 반환
  // 4) A..Z 스캔해서 taken 아닌 첫 글자 반환
  // 5) 'P'
}

// 해당 draft+prefix 안에서 사용 가능한 가장 작은 suffix (0부터).
export function pickSuffix(
  presets: Preset[],
  draftId: string,
  prefix: string,
): number {
  // draftId 일치 + 같은 prefix 인 preset 들의 suffix 집합 used.
  // n=0 부터 used 에 없을 때까지 증가. 그 n 반환.
}

// 새 preset 1건의 자동 코드.
export function generatePresetCode(
  presets: Preset[],
  drafts: RecipeDraft[],
  draftId: string,
): string {
  const prefix = pickPrefix(presets, drafts, draftId)
  const suffix = pickSuffix(presets, draftId, prefix)
  return `${prefix}${suffix}`
}
```

**v2 → v3 매핑 주의**
- v2 `state.presets`(객체 맵) → v3 `Preset[]` (배열). `Object.values(...)` → 배열 그대로 순회.
- v2 `p.productId` → v3 `preset.draftId`.
- v2 `state.productOrder`(productId 배열) → v3 `drafts`를 `sortOrder` 오름차순 정렬한 배열의 인덱스. (`order.indexOf(productId)` → `sortedDrafts.findIndex(d => d.id === draftId)`)
- 동률·결정성: v2와 동일하게 "가장 흔한 prefix, 동률은 첫 등장", "빈 최소 suffix"를 유지.

### 3-2. `src/features/presets/presetCodes.test.ts` (신규) — 테스트

최소 케이스:
- `parseCode`: `'B0'`→`{prefix:'B',suffix:0}`, `'N12'`→`{N,12}`, `''`/`'x'`/`'b0'`(소문자)/`'B'`(숫자없음)→`null`
- `preferredPrefixOfDraft`: 한 draft에 `A0,A1,B0` → `'A'`(흔함). 동률(`A0,B0`)이면 첫 등장 prefix. 프리셋 없으면 `''`
- `pickPrefix`:
  - draft가 이미 `C`를 쓰면 → `'C'`(own 우선)
  - 빈 draft + sortOrder 인덱스 0,1,2 → `A`,`B`,`C` (인덱스 기반)
  - 인덱스 글자가 다른 draft에 taken이면 → 다음 빈 글자
- `pickSuffix`: `A0,A1` 있으면 → `2`. `A0,A2` 있으면(중간 빔) → `1`. 없으면 → `0`
- `generatePresetCode`: 빈 draft 첫 프리셋(인덱스 0) → `'A0'`. 기존 `A0`만 있는 draft → `'A1'`

### 3-3. `src/pages/PresetsPage.tsx` (수정) — 모달 기본값 자동 채우기

- `PresetFormModal`에 **추가 모드일 때 code 자동값**을 기본값으로 넣는다.
- 현재 `defaultFormValues(preset?)`는 편집(preset 있음)/추가(preset 없음)를 구분한다. 추가일 때 `code: ''` → 이걸 `generatePresetCode(...)` 결과로.
- 구현 방법(택1, 깔끔한 쪽):
  - `PresetFormModal`에 `presets: Preset[]`, `drafts: RecipeDraft[]`(또는 정렬된 drafts)를 prop으로 넘기고, 모달 내부에서 `editing`이 없을 때 `defaultValues.code = generatePresetCode(presets, drafts, draft.id)`.
  - 또는 `PresetsPage`에서 모달 열기 직전 자동 코드를 계산해 `modalState`에 실어 보내기.
- **편집 모드는 기존 code 그대로** (자동 부여 금지).
- 자동값은 **사용자가 input에서 수정 가능**해야 한다(필드 비활성화 X). 현 폼·검증(`presetFormSchema`)은 그대로.
- `handleSave`는 그대로(폼의 `values.code.trim()`을 저장). 자동값이 폼 기본값으로 들어가므로 추가 로직 불필요.

### 3-4. (확인) 기존 동작 보존

- 자동 코드를 채운 뒤에도 **수동 입력·편집·삭제 모두 0.5-D와 동일하게 동작**해야 한다.
- Firestore write 경로는 0.5-D `presetMutations.ts`(`useUpsertPreset`) 그대로. **이번에 mutation/쿼리 변경 없음.**

## 4. 제약

- `tsconfig.app.json`: `verbatimModuleSyntax`(`import type`), `erasableSyntaxOnly`(**enum 금지**, union), `noUncheckedIndexedAccess`(정규식 그룹·배열 인덱스 `undefined` 처리 필수)
- 상대경로 import, alias 없음
- `presetCodes.ts`는 순수 — `react`/`firebase`/`@tanstack` import 금지
- **새 라이브러리 추가 금지.** @dnd-kit은 이번에 쓰지 않는다(0.5-G).
- v2 `computeNormalizedPresets`는 포팅하지 말 것 (범위 밖)
- 기존 프리셋 코드를 **자동으로 바꾸지 말 것** — 이번 자동부여는 "신규 추가 모달의 기본값"에만 적용

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과
- `npm run dev` → `/presets`:
  - 레시피 선택 → "프리셋 추가" → **code 칸에 자동값이 미리 채워져 있음**(예: 그 레시피가 `A0,A1`을 쓰면 `A2`, 첫 프리셋이면 인덱스 기반 글자+`0`)
  - 자동값을 수정해서 저장도 됨
  - 편집 모달은 기존 code 그대로
  - 추가/편집/삭제가 0.5-D처럼 정상 + 목록 자동 갱신

## 6. 보고 양식

- 변경/신규 파일
- 순수 함수 테스트 케이스 수
- v2 → v3 매핑에서 내린 결정(특히 productOrder → drafts sortOrder 인덱스)
- 모달 기본값 주입 방식(prop 전달 vs modalState에 실음) 중 택한 것과 이유
- 빠뜨린 것·애매했던 결정 surface

---

## 아키텍트 노트 (Claude → Codex)

- **`computeNormalizedPresets`를 뺀 이유**: v2의 그 함수는 전체 프리셋의 prefix 충돌을 일괄 해소하며 기존 코드를 바꾼다. 마이그레이션된 100개 코드를 대량 재작성 → Firestore write 폭증 + "사람이 익숙한 코드"가 바뀌는 부작용. 충돌이 실제로 문제되는지 확인 후 별도로 다루는 게 맞다. 이번엔 "신규 1건 자동 부여"로 범위를 좁힌다.
- **prefix는 draft(레시피)당 1글자가 원칙**(v2 동일). 자동부여는 그 draft가 이미 쓰는 글자를 이어쓰고(suffix만 증가), 첫 프리셋이면 draft 순서 기반으로 안 겹치는 글자를 고른다.
- **drafts sortOrder 인덱스**가 v2 `productOrder` 역할이다. `usePresets`/`useRecipeDrafts`는 이미 sortOrder로 정렬해 반환하지만, `pickPrefix`는 순수 함수이므로 **내부에서 한 번 더 sortOrder 정렬**해 입력 순서에 의존하지 않게 할 것(결정성).
- **자동값은 강제가 아니라 기본값**이다. SPEC §5.5 "자동 부여"의 취지는 매번 손으로 코드를 짜지 않게 하는 것 — 사용자가 덮어쓸 수 있어야 한다.
- 다음(0.5-G)은 @dnd-kit 드래그 정렬이다. 이번 `presetCodes.ts`와 독립이니 서로 안 건드린다.
