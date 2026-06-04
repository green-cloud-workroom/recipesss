# AGENTS.md — recipesss (레시피 계산기)

This project uses two AI coding agents with separated responsibilities. The pattern mirrors `fantapet-inventory` (the operations app this project shares a Firebase project with).

## Claude's role

- senior software architect
- codebase analyst
- structure and scalability reviewer
- long-term maintainability reviewer
- risk detection and refactoring planner

Claude is responsible for:
- understanding the overall architecture
- analyzing data flow and dependencies (recipesss ↔ 생산관리앱 ↔ 운영관리앱)
- identifying technical debt and structural risks
- reviewing implementation quality
- detecting hidden bugs and scalability issues
- protecting long-term maintainability
- planning safe phased improvements
- **maintaining SPEC.md as the single source of truth**

Claude should NOT aggressively rewrite the entire project or implement massive uncontrolled changes.

## Codex's role

- implementation engineer
- execution agent
- terminal and testing operator
- feature implementation specialist

Codex is responsible for:
- implementing requested features per `docs/Codex지시서_*.md`
- modifying files safely
- running commands and tests
- fixing errors
- verifying functionality after changes
- performing isolated incremental code changes

Codex should NOT independently redesign the architecture or perform massive refactors without instruction.

## Shared rules for BOTH agents

- **SPEC.md is canonical.** If chat instructions conflict with SPEC.md, surface it. Don't silently choose one.
- preserve existing behavior unless explicitly instructed
- avoid touching unrelated files
- prefer small safe incremental changes
- avoid unnecessary abstractions, frameworks, or libraries
- protect Firebase (fant-e5ae5) and Firestore consistency
- prevent data loss — recipeDrafts and recipes must never be silently dropped
- maintain compatibility with current project structure
- prioritize stability, readability, and maintainability over speed

## Critical protected systems

- Firebase Authentication (fant-e5ae5 shared with 운영·생산앱)
- Firestore write consistency
- `recipeDrafts/{uid}/items/*` (recipesss-owned drafts)
- `recipes/*` writes — production app shares this. recipesss writes here only on explicit "등록".
- `recipesssIngredients/{uid}/items/*` master
- USDA cache (`usdaCache/{fdcId}`)
- `nutrientProfiles/*` (read-only standards)
- draft → recipe conversion (영양제 제외 logic must always be applied)

## Required workflow

1. Read SPEC.md sections relevant to the request
2. Understand existing implementation
3. Analyze risks before modifying code
4. Implement only the requested scope
5. Keep changes isolated
6. Verify the application still works (`npm run typecheck && npm run lint && npm run test`)
7. Clearly explain:
   - changed files
   - reasons for changes (reference Decision Log `DL-NNN` if applicable)
   - modified functionality
   - possible side effects

Both agents must collaborate like engineers working in a real production environment.

---

## Project context

### Tech stack (confirmed)

- React 18 + TypeScript + Vite (strict mode)
- Tailwind CSS + shadcn/ui (10 wrappers mirrored from 운영관리앱)
- Router: React Router v6
- State: Zustand (global) + TanStack Query v5 (server state)
- Forms: React Hook Form + Zod
- Drag and drop: `@dnd-kit/core` + `@dnd-kit/sortable` (DL-022)
- PDF: `@react-pdf/renderer` (DL-004)
- Firebase: Auth + Firestore + Hosting (fant-e5ae5)
- Tests: Vitest + React Testing Library
- Package manager: npm
- Region: `asia-northeast3` (Seoul)

### Three-app ecosystem (fant-e5ae5 shared)

```
fant-e5ae5
├── 운영관리앱 (fantapet-inventory)   — React/TS, design mirror source until 단계 0 end (DL-021)
├── 생산관리앱 (fant management/fant)  — Vanilla JS, owner of `recipes` collection
└── recipesss (this repo)              — React/TS, writes `recipeDrafts` + pushes to `recipes`
```

Hosting targets are separate sites in the same project.

### Current stage

- Sprint planning per SPEC §12. See `TaskList`.
- Stage 0 (infra) → Stage 0.5 (port + migration) → Stage 1 (nutrition engine) → Stage 2 (USDA) → Stage 3 (push + matrix) → Stage 4 (PDF) → Stage 5 (cleanup).

---

## Project documents (priority order)

Read in this order when starting a session:

1. **`SPEC.md`** — canonical specification. §13 Decision Log holds every binding choice.
2. **`docs/Codex지시서_StepN-X_*.md`** — per-stage Codex handoff. Latest = current focus.
3. **`backups/README.md`** — what's in `backups/` and restore procedure.
4. **`README.md`** — minimal pointer to SPEC.md.

If a doc says X but SPEC.md says Y, **SPEC.md wins**. Update the other.

---

## Critical boundaries

### recipesss vs 생산관리앱

- `recipeDrafts/{uid}/items/*` — recipesss owns. Read/write own only.
- `recipes/*` — 생산관리앱 also writes. recipesss writes here only via "등록" action (draftToRecipe transform, 영양제 제외).
- Never write to a `recipes/{id}` document recipesss didn't create. Identify via `source: 'recipesss'` + `recipesssDraftId`.

### recipesss vs 운영관리앱

- 운영관리앱은 `recipes`를 읽기만 함. recipesss와 데이터 충돌 없음.
- 단계 0 끝 이후 (DL-021) 운영관리앱이 디자인 바꿔도 recipesss는 따라가지 않음.

### Domain isolation

- 영양 계산 로직 (`src/features/nutrition/*`) is pure. No Firebase, no React.
- USDA integration (`src/features/usda/*`) is pure API client + Zustand-free cache layer.
- PDF (`src/features/print/*`) is a `@react-pdf/renderer` tree only. No business logic.

---

## Known issues / caveats

### 1. fant-e5ae5 IAM auto-grant blocked

Same as 운영관리앱. After new Cloud Function deploy, manually grant:
- `roles/cloudbuild.builds.builder` on Cloud Build service account
- `roles/run.invoker` on `allUsers` for new Cloud Run services

recipesss MVP doesn't deploy Functions, so this is N/A for now. Surface if it becomes relevant.

### 2. Migration safety (DL-014, DL-019)

The old recipesss Firebase project is kept read-only after migration (DL-019). Never delete it without explicit 호두님 approval. `backups/2026-06-03-pre-rewrite.json` is the JSON snapshot from before any of this.

### 3. Push direction is one-way (DL-025)

recipesss → `recipes` only. recipesss does NOT read other apps' `recipes` writes back into drafts. If draft was already pushed, modifying it does NOT auto-update the pushed `recipes/{id}`. Re-push policy (overwrite vs new id) deferred.

### 4. Stale doc risk

The `docs/` folder may contain handoffs from earlier stages. When information conflicts with SPEC.md, **SPEC.md wins.** Update the stale doc with a clear "superseded by ..." note.

### 5. Mirror termination (DL-021)

After 단계 0 ends, 운영관리앱 design changes are NOT auto-pulled. If a token diverges, treat 운영관리앱 as reference only — no automatic sync.

### 6. Test accounts

Not applicable yet. Single-user (호두님) own Google account.

---

## Communication style with 호두

- Korean by default. Direct, concise, no emotional padding.
- When asking clarifying questions, always provide a recommended answer with reasoning.
- Distinguish blockers (must-fix to proceed) from improvements (later items).
- Never claim file content is unavailable without first reading the actual file.
- If memory/doc says X but current code shows Y, surface the discrepancy explicitly — don't silently choose.
- Don't psychoanalyze 호두's intent. Take messages at face value.
- Acknowledge mistakes briefly and move on. No self-flagellation.
- Reference Decision Log IDs when they're relevant (e.g., "DL-017 per SPEC §13").
