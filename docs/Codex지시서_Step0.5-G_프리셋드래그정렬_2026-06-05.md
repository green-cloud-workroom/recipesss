# Codex 지시서 — Step 0.5-G: 프리셋 드래그&드롭 정렬 (`/presets`)

> 작성: Claude (아키텍트) · 2026-06-05 · 구현: Codex
> 정본: **SPEC.md §5.5, §8.2**. 충돌 시 SPEC.md 우선 — 발견하면 멈추고 surface.

---

## 0. 전제·맥락

- 0.5-D(프리셋 CRUD) + 0.5-F(코드 자동부여)에 이은 발주 그룹 마무리. SPEC §5.5의 "프리셋 편집·삭제·**드래그&드롭 정렬**"의 정렬을 구현한다.
- `Preset.sortOrder`는 이미 모델에 있고(`src/types/recipe.ts`), 목록은 `sortOrder` 오름차순으로 정렬돼 표시된다(`selectPresetsByDraft`). 이번엔 **사용자가 드래그로 그 순서를 바꾸고 Firestore에 저장**한다.
- **이번엔 실제 Firestore write가 들어간다** (선택 레시피의 프리셋 `sortOrder` 갱신). write 범위를 `recipesssPresets`로 좁게 유지한다.
- @dnd-kit 3종(`@dnd-kit/core`·`@dnd-kit/sortable`·`@dnd-kit/modifiers`)은 **이미 설치돼 있다** (DL-022). 새 라이브러리 추가 금지.

## 1. 목표·범위

### IN (이번에 구현)

1. 순수 함수 `presetReorder.ts`: 드래그 결과(active/over id)로 그 draft 프리셋의 새 `sortOrder` 배열 계산 + 테스트.
2. mutation `useReorderPresets`: 바뀐 프리셋들을 **`writeBatch`로 한 번에** 저장 + **낙관적 업데이트**(아래 §아키텍트 노트 이유).
3. `/presets` 우측 프리셋 테이블에 **드래그 핸들 + 행 정렬**(@dnd-kit). 드롭 시 `useReorderPresets` 호출.

### OUT (이번에 만들지 말 것)

- ❌ 레시피(draft) 목록 자체의 드래그 정렬 — 이번엔 **프리셋 행만**. (좌측 레시피 리스트는 손대지 말 것)
- ❌ 코드 자동부여·CRUD 로직 변경(0.5-D/F 그대로)
- ❌ 발주(`/orders`)·다른 페이지 변경
- ❌ 크로스 draft 이동(다른 레시피로 프리셋 끌어다 놓기) — **같은 레시피 안에서만** 순서 변경

## 2. 먼저 읽을 것

- `SPEC.md` §5.5(드래그&드롭 정렬), §8.2(Query 키 — `['recipesssPresets']`)
- `src/types/recipe.ts` — `Preset.sortOrder`
- `src/features/presets/presetSelectors.ts` — `selectPresetsByDraft`(sortOrder 정렬), `nextSortOrder`
- `src/features/presets/presetMutations.ts` — `useUpsertPreset`/`useDeletePreset` 패턴 + `presetRef`. **여기에 `useReorderPresets` 추가**
- `src/pages/PresetsPage.tsx` — 우측 프리셋 `<table>`(현재 `visiblePresets.map`으로 `<tr>` 렌더, 약 199~248행)
- @dnd-kit/sortable 표준 패턴(`DndContext`/`SortableContext`/`useSortable`/`arrayMove`)

## 3. 구현 단위

### 3-1. `src/features/presets/presetReorder.ts` (신규) — 순수 함수 ★

> React/dnd/firebase import 금지. `arrayMove`도 import하지 말고 splice로 직접 이동(순수 격리).

```ts
import type { Preset } from '../../types/recipe'

// draftPresets: 한 draft의 프리셋, sortOrder 오름차순 정렬된 상태로 들어온다고 가정.
// activeId 를 overId 위치로 이동한 뒤 sortOrder 를 0..n 으로 재할당.
// 반환: sortOrder 가 실제로 바뀐 프리셋만 (write 최소화). 변경 없으면 빈 배열.
export function reorderPresets(
  draftPresets: Preset[],
  activeId: string,
  overId: string,
): Preset[] {
  const from = draftPresets.findIndex((p) => p.id === activeId)
  const to = draftPresets.findIndex((p) => p.id === overId)
  if (from === -1 || to === -1 || from === to) return []

  const next = [...draftPresets]
  const moved = next[from]
  if (moved === undefined) return [] // noUncheckedIndexedAccess
  next.splice(from, 1)
  next.splice(to, 0, moved)

  const changed: Preset[] = []
  next.forEach((preset, index) => {
    if (preset.sortOrder !== index) {
      changed.push({ ...preset, sortOrder: index })
    }
  })
  return changed
}
```

**테스트** `presetReorder.test.ts`:
- 아래로 이동(0→2): 영향 행들의 sortOrder 재할당, 바뀐 것만 반환
- 위로 이동(2→0)
- 같은 위치(from===to) → `[]`
- 없는 id → `[]`
- 재할당이 0부터 연속인지(빈 배열 입력 → `[]`)
- 이미 정렬된 상태에서 이동 시 안 바뀐 행은 결과에 없는지

### 3-2. `src/features/presets/presetMutations.ts` (수정) — `useReorderPresets` 추가 ★

> 0.5-D 패턴 확장. 단, **이 mutation만 낙관적 업데이트**를 쓴다(드래그 UX 때문 — §아키텍트 노트).

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

// presetRef 는 기존 것 재사용

export function useReorderPresets(uid: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    // changed = reorderPresets(...) 결과(바뀐 프리셋들, sortOrder 갱신됨)
    mutationFn: async (changed: Preset[]) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      if (changed.length === 0) return
      const batch = writeBatch(db)
      for (const preset of changed) {
        batch.set(presetRef(uid, preset.id), preset) // 전체 객체 덮어쓰기(0.5-D와 동일)
      }
      await batch.commit()
    },
    // 낙관적: 캐시의 ['recipesssPresets'] 를 바뀐 sortOrder 로 즉시 갱신
    onMutate: async (changed: Preset[]) => {
      await qc.cancelQueries({ queryKey: ['recipesssPresets'] })
      const previous = qc.getQueryData<Preset[]>(['recipesssPresets'])
      if (previous) {
        const map = new Map(changed.map((p) => [p.id, p.sortOrder]))
        const next = previous.map((p) =>
          map.has(p.id) ? { ...p, sortOrder: map.get(p.id) as number } : p,
        )
        qc.setQueryData(['recipesssPresets'], next)
      }
      return { previous }
    },
    onError: (_err, _changed, context) => {
      // 롤백
      if (context?.previous) {
        qc.setQueryData(['recipesssPresets'], context.previous)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['recipesssPresets'] }),
  })
}
```

- 기존 `useUpsertPreset`/`useDeletePreset`는 **그대로** (낙관적 안 씀, invalidate만). 변경하지 말 것.
- `fetchPresets`가 반환 시 `sortOrder`로 정렬하므로, 낙관적으로 sortOrder만 바꿔도 `selectPresetsByDraft`에서 재정렬되어 순서가 즉시 반영된다.

### 3-3. `src/pages/PresetsPage.tsx` (수정) — 드래그 UI

- 우측 프리셋 `<table>`의 `<tbody>`를 @dnd-kit으로 정렬 가능하게:
  - `DndContext`(sensors: `PointerSensor`, collisionDetection: `closestCenter`, modifiers: `restrictToVerticalAxis`, `restrictToParentElement` 선택) 로 테이블(또는 tbody 영역)을 감싼다.
  - `SortableContext`(items = `visiblePresets.map(p => p.id)`, strategy = `verticalListSortingStrategy`).
  - 각 행을 `useSortable({ id: preset.id })`로 만든 **행 컴포넌트**로 분리(예: `PresetRow`). `setNodeRef`, `transform`/`transition`을 `<tr>` style에 적용.
  - **드래그 핸들**: 행 맨 앞에 핸들 셀(`<td>`) 추가 + `<thead>`에도 빈 `<th>` 1개. 핸들에 `attributes`/`listeners` 부착(행 전체가 아니라 핸들에만 — 편집/삭제 버튼 클릭과 충돌 방지). 핸들 아이콘은 텍스트 `⠿`/`≡` 또는 간단한 마크업.
- `onDragEnd(event)`:
  ```ts
  const { active, over } = event
  if (!over || active.id === over.id) return
  const changed = reorderPresets(visiblePresets, String(active.id), String(over.id))
  if (changed.length > 0) void reorderPresets_mutation.mutateAsync(changed).catch(...)
  ```
  - `visiblePresets`(현재 선택 draft의 정렬된 프리셋)를 그대로 `reorderPresets`에 넘긴다.
- mutation 진행 중 표시는 기존 `mutationPending`에 `reorder.isPending`을 OR로 합쳐도 되지만, **드래그는 낙관적이라 버튼 disable로 막을 필요는 없다.** 편집/삭제 버튼 disable 조건은 기존 유지.
- 에러 시: 기존 `errorMsg` 패턴 재사용해 표시(낙관적이 롤백되므로 순서는 원복됨).

### 3-4. 행 컴포넌트 분리 주의

- `useSortable`은 훅이라 `.map` 콜백에서 직접 못 쓴다 → **각 행을 컴포넌트로** 분리(`PresetRow`). 기존 셀(코드·목표량·라벨·투입량·액션)은 그대로 옮기고 맨 앞에 핸들 셀만 추가.
- 편집/삭제 핸들러는 prop으로 내려준다.

## 4. 제약

- `tsconfig.app.json`: `verbatimModuleSyntax`(`import type`), `erasableSyntaxOnly`(**enum 금지**), `noUncheckedIndexedAccess`(배열 인덱스·`get()`·`transform` undefined 처리)
- 상대경로 import, alias 없음
- `presetReorder.ts`는 순수 — `react`/`firebase`/`@tanstack`/`@dnd-kit` import 금지
- **write는 `recipesssPresets/{uid}/items` 만.** `recipeDrafts`·`recipes` 등 다른 컬렉션 write 금지
- `setDoc`은 전체 객체 덮어쓰기 — `sortOrder`만 바꾼 **전체 Preset 객체**를 batch.set (부분 update 금지, undefined 필드 금지)
- 새 라이브러리 추가 금지(@dnd-kit는 이미 설치)
- 좌측 레시피 목록 드래그·크로스 draft 이동은 범위 밖

## 5. 검증 (완료 기준)

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
- 전부 통과
- `npm run dev` → `/presets`:
  - 레시피 선택 → 프리셋 행을 **핸들로 드래그**해 순서 변경 → 드롭 즉시 새 순서 유지(원위치로 안 튐)
  - **새로고침해도 순서 유지**(Firestore `sortOrder` 반영 확인)
  - 편집/삭제/추가가 0.5-D/F처럼 정상
  - DevTools Network: 드롭 시 `recipesssPresets` write가 **바뀐 행 수만큼만** 발생(전체 재기록 아님)
- 드래그 중 편집/삭제 버튼이 오작동(드래그로 오인)하지 않는지

## 6. 보고 양식

- 변경/신규 파일
- 순수 함수 테스트 케이스 수
- 낙관적 업데이트 구현(onMutate/onError/onSettled) 동작 확인
- 드래그 핸들을 행 전체가 아닌 핸들에만 둔 처리(버튼 클릭 충돌 방지) 방식
- 한 번의 드래그에서 실제 write된 문서 수(바뀐 행만인지)
- 빠뜨린 것·애매했던 결정 surface
- side effect 가능성(특히 batch write 경로)

---

## 아키텍트 노트 (Claude → Codex)

- **왜 이 mutation만 낙관적 업데이트인가**: 0.5-D는 "낙관적 금지, invalidate만"을 표준으로 정했다(추가/편집/삭제엔 그게 맞다 — 단순·안전). 하지만 @dnd-kit 드래그는 드롭 시점에 데이터가 즉시 새 순서가 아니면 행이 **원위치로 튕긴 뒤** 재조회 후 다시 이동하는, 눈에 띄게 거슬리는 깜빡임이 난다. 그래서 드래그만 `onMutate`에서 캐시를 즉시 갱신(낙관적)하고, 실패 시 `onError`로 롤백, `onSettled`에서 invalidate로 서버와 최종 동기화한다. 이건 0.5-D 원칙의 "예외"이며 이유가 분명하다.
- **write 최소화**: `reorderPresets`가 sortOrder가 실제로 바뀐 행만 반환하므로, batch에는 변경분만 담긴다. 한 draft의 프리셋은 보통 5~10개라 batch 한 번이면 충분하고 원자적이다.
- **순수 함수에 `arrayMove`를 import하지 않은 이유**: `arrayMove`는 @dnd-kit/sortable export지만, 도메인 순수 파일(`presetReorder.ts`)이 dnd에 의존하면 격리가 깨진다. splice 2줄로 충분하니 직접 구현한다. UI(PresetsPage)에서는 @dnd-kit를 마음껏 써도 된다.
- **핸들 분리**: 드래그 listeners를 `<tr>` 전체가 아니라 핸들 셀에만 붙여야 편집/삭제 버튼 클릭이 드래그로 오인되지 않는다. 표준 dnd 패턴이다.
- **크로스 draft 이동 제외**: 프리셋은 `draftId`에 묶이고 화면도 선택 레시피의 프리셋만 보여준다. 다른 레시피로 끌어다 놓는 건 의미·정합성(코드 prefix 등)이 복잡해지므로 이번 범위에서 뺀다.
- 다음은 0.5 이식 마무리 점검 또는 단계 1(영양 엔진) 착수다. 드래그까지 끝나면 프리셋·발주 그룹은 MVP 기능이 갖춰진다.
