# archive/

옛 문서·파일 보관. **참고용**. 현재 작업은 `SPEC.md` v0.3 이상 정본 기준.

## old/
- `index.local-backup-before-redownload.html` — v2 재설계 이전 HTML 로컬 백업
- `레시피_엑셀_일괄등록_스펙.md` — 2026-05-13 엑셀 일괄등록 부분 스펙 (SPEC.md로 통합)
- `레시피_엑셀_일괄등록_핸드오프_2026-05-13.md` — 위 스펙의 코덱스 핸드오프

### 단계 0-A 정리 (2026-06-04)
- `legacy-index.html` — 옛 바닐라 JS SPA 진입점 (Vite로 대체)
- `order.html`, `restore.html` — 옛 부속 페이지
- `recipesss-localstorage-recovered.json` — 옛 복구 데이터 (현 backups/가 정본)
- `legacy-firebaserc`, `legacy-firebase.json`, `legacy-firestore.rules` — 구 Firebase 프로젝트(recipeee-da9d3) 설정. fant-e5ae5로 이전 후 보존만 (DL-017, DL-019).
- `index.legacy-before-v2-2026-05-13.html` — v2 이전 더 옛 HTML
- `v2-source/` — 옛 v2/ 디렉토리 통째 (modules/main.js, ui-tab-*.js, schema.js 등). 단계 0.5 이식 시 참조용.

확신 들면 삭제 가능. 데이터 안전망은 `backups/2026-06-03-pre-rewrite.json`이 따로 있음.
