// 단계 0-A: 골격만. 라우터·페이지·사이드바는 0-B/0-C에서.
export function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 font-sans">
      <div className="rounded-lg bg-white p-10 text-center shadow-sm">
        <h1 className="text-title font-semibold text-gray-800">레시피 계산기</h1>
        <p className="mt-2 text-helper text-gray-500">
          v1.0.0 · 단계 0-A 부팅 완료
        </p>
      </div>
    </div>
  )
}

export default App
