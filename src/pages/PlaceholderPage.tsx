import { EMPTY_STATE_CLS } from '../lib/ui'

// 단계 0-B: 모든 라우트가 이 컴포넌트로 빈 화면 표시. 각 단계에서 진짜 페이지로 대체.

export function PlaceholderPage({
  title,
  stage,
}: {
  title: string
  stage?: string
}) {
  return (
    <div>
      <h1 className="text-title font-bold text-gray-800">{title}</h1>
      <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
        {stage ? `${stage}에서 구현됩니다.` : '구현 예정.'}
      </div>
    </div>
  )
}
