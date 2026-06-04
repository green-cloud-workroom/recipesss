# recipesss

레시피 계산기. **정본 스펙은 [`SPEC.md`](./SPEC.md)**. 협업 규약은 [`CLAUDE.md`](./CLAUDE.md).

## 스택

React 18 · TypeScript · Vite · Tailwind · shadcn/ui (운영관리앱 mirror, 단계 0까지)
Zustand · TanStack Query · React Hook Form · Zod
Firebase (fant-e5ae5: 운영·생산앱과 공유)
@react-pdf/renderer · @dnd-kit · Vitest

## 개발

```bash
npm install
cp .env.example .env.local   # Firebase 값 채우기
npm run dev                  # http://127.0.0.1:5175
npm run typecheck
npm run lint
npm run test
npm run build
```

## 배포

```bash
npm run deploy:hosting       # Firebase Hosting recipesss 타겟
```

## 디렉토리

```
src/
  App.tsx           단계 0-A 골격
  main.tsx          entry
  index.css         Tailwind
  firebase.ts       fant-e5ae5 init
  lib/
    utils.ts        cn(...)
    ui.ts           PRIMARY_BTN_CLS 등 (운영관리앱 mirror)
  test/setup.ts     vitest
public/             PWA 자산
docs/               Codex 단계별 핸드오프
backups/            데이터 스냅샷 (영구 보관)
archive/            폐기·옛 파일
```

## 작업 순서

SPEC §12 참조. 단계 0 → 0.5 → 1 → 2 → 3 → 4 → 5.

## 데이터 안전

`backups/2026-06-03-pre-rewrite.json` 이 v2 시점 마지막 스냅샷 (24개 레시피). 데이터 손실 위험 시 복원 가능.
