# 핸드오프 — 2026-06-04 세션2 → 다음 세션

> ⚠️ **너는 새 Claude Code 세션(아키텍트)이다. 이 문서가 현재 상태 + 다음 작업이다.**
> 즉시: `pwd`(= `C:\dev\recipesss` 확인) → 이 문서 끝까지 → `CLAUDE.md`/`AGENTS.md` →
> `SPEC.md`(§5, §8, §13) → 아래 "다음 작업"의 발주 지시서 작성.

---

## 0. 역할 (이번에 확정됨)

| | 담당 |
|---|---|
| **Claude (너)** | 아키텍트 — SPEC 관리, `docs/Codex지시서_*.md` 작성, Codex 구현 **리뷰**, 위험 분석 |
| **Codex** | 구현 — 호두님이 별도 세션에서 띄움. 지시서 받아 코드 구현·테스트·보고 |

협업 사이클(이미 2회 안정적으로 돎): **너가 지시서 작성 → 호두님이 Codex에 전달 → Codex 구현·보고 → 너가 게이트 재확인 + 리뷰 → 통과 시 너가 커밋·push.**

- `CLAUDE.md`(Claude용)·`AGENTS.md`(Codex용) 둘 다 "Claude=아키텍트, Codex=구현"으로 정합. (세션2에서 AGENTS.md 헤더 버그 수정함)

## 1. 오늘(세션2) 한 일

**긴급 — 구 v2 앱 복구** (작업 중 호두님 실무앱이 안 떠서 우회):
- 원인: main을 React로 덮으며 GitHub Pages 깨짐. → **`gh-pages` 브랜치**에 v2 정적 소스(`archive/old/v2-source/`) 배포.
- **구 v2 = https://green-cloud-workroom.github.io/recipesss/** (상시 운영, 데이터는 구 Firebase `recipeee-da9d3`에서 sync). GitHub repo Settings→Pages가 gh-pages 가리킴.
- v2 출력1에 생산단위 투입량 `P2 (3)` 표시 추가(`ui-tab-preview.js` `formatUnitInput`). archive 정본도 동기화.

**본류 — 단계 0.5 진행** (전부 커밋·push 완료, `origin/main`):
- `b7ff641` 0.5-A: `migrateV2toV3` 함수 + 테스트
- `ea7ee10` fix: 누락 preset 필드 정규화(undefined→0/'')
- `2329817` 0.5-B(빌더): `buildMigrationPlan` write 플랜
- `6f2abee` 0.5-B(UI): `/settings` 마이그레이션 UI
- `aaf1194` 0.5-C: 레시피 목록 `/recipes` (read+필터) — Codex 구현, Claude 리뷰
- `a8a9acf` 0.5-D: 프리셋 `/presets` (read+CRUD) — **첫 write 화면, mutation 패턴 확립**
- SPEC: DL-031(마이그레이션=앱내UI+backups JSON), §11.2, §5.7(출력1 생산단위), §8.2(uid 정책)

**마이그레이션 실제 실행됨**: `/settings`에서 backups JSON 업로드 → **218건**(drafts 27 / ingredients 91 / presets 100) fant-e5ae5에 기록. `/recipes`에서 27개(cat13/dog8/none6) 확인 완료. **데이터가 이미 fant-e5ae5에 있다.**

## 2. 앱 URL

| | URL | 호스팅 | 비고 |
|---|---|---|---|
| 신규(React) | https://recipesss-app.web.app | Firebase Hosting (fant-e5ae5) | `npm run deploy:hosting` 으로 배포 |
| 구 v2(임시) | https://green-cloud-workroom.github.io/recipesss/ | GitHub Pages (gh-pages) | 신규 완성까지 상시 운영 |
| 로컬 dev | http://127.0.0.1:5175 | `npm run dev` | 호두님이 띄워둠 |

## 3. ⚠️ 보류·주의

- **`firestore.rules` + `firebase.json` 미커밋(워크트리에 남아있음).** 호두님이 fant-e5ae5 전체 규칙(운영+생산+recipesss)을 반영하고 recipesss 3개 컬렉션 규칙을 추가해 배포함. **이 파일은 공유 프로젝트 전체 규칙**이라 정본 위치(생산앱 단독 vs 통합)가 미정. **커밋 보류 중 — 0.5 커밋 시 항상 제외할 것.** `git add` 할 때 `firestore.rules`/`firebase.json` 빼고 명시적으로 파일 지정.
- **Firestore 규칙 deploy는 access control 변경 → Claude가 직접 실행하지 않는다.** 호두님이 직접. (안전 원칙)
- `AGENTS.md`는 커밋됨. `firestore.rules`는 `??`(untracked)로 남겨둘 것.

## 4. 다음 작업 (추천 = 발주 페이지)

**0.5 발주 페이지 `/orders` Codex지시서 작성** — SPEC §5.6.
- 프리셋(0.5-D 완료)을 선택해 이번 회차 주문량 입력. 간결 표시(`(고양이)치킨 a0 20 / a1 40`).
- 데이터: `recipesssPresets` read(이미 `usePresets` 있음) + 선택 상태. 출력 연동(`/print`)은 단계 4라 이번 제외.
- **0.5-C/D 패턴 그대로**: 순수 함수(선택/집계) + 테스트 분리, read 중심. write 있으면 0.5-D `presetMutations.ts` 패턴 재사용(낙관적 X, invalidate).
- 범위 명확히 자를 것(주문량 입력·표시까지. PDF·출력은 단계 4).

대안: ① 0.5-D 후속(코드 자동부여 — v2 `archive/old/v2-source/modules/preset-codes.js` 분석 + 유니크검증 + 드래그정렬) ② 원료 마스터 `/ingredients` read 골격(91개 표시).

## 5. 지시서 작성 시 체크리스트 (0.5-C/D에서 검증된 것)

- 제약: `verbatimModuleSyntax`(import type), `erasableSyntaxOnly`(**enum 금지**, union), `noUncheckedIndexedAccess`, 상대경로(alias 없음)
- 순수 로직은 `src/features/<도메인>/*.ts` 순수 함수로 빼고 Vitest. UI는 얇게.
- Query 키 정책 SPEC §8.2 (1인 사용, uid 미포함). write는 invalidate.
- 검증: `npm run typecheck && npm run lint && npm run test && npm run build`
- 리뷰 시 직접 게이트 재실행 + write면 undefined 필드(Firestore 거부) 확인.
- 커밋: "Implemented by Codex per 지시서, reviewed by Claude" 명시. Co-Authored-By: Claude Opus 4.8.

## 6. 소통 (CLAUDE.md)

한국어·직설·간결. 질문 시 추천+근거. 블로커 vs 개선 구분. SPEC이 정본 — 코드와 다르면 surface. DL 참조.

---

*세션2 끝. origin/main = `a8a9acf` + 이 문서 커밋. 다음은 발주 지시서부터.*
