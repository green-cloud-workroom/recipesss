import { lazy, Suspense } from 'react'

// @react-pdf 번들이 커서 출력 페이지만 코드 스플릿 (단계 4).
const PrintPage = lazy(() => import('./PrintPage'))

export function PrintPageLazy() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
          출력 모듈 불러오는 중...
        </div>
      }
    >
      <PrintPage />
    </Suspense>
  )
}

export default PrintPageLazy
