import { createBrowserRouter } from 'react-router-dom'

import { AppLayout } from '../components/AppLayout'
import { PlaceholderPage } from '../pages/PlaceholderPage'

// SPEC §5.1 라우트 트리.
// 단계 0-B에선 모두 PlaceholderPage. 각 단계에서 실제 페이지로 교체.

export const appRouter = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <PlaceholderPage title="대시보드" stage="단계 5" /> },
      {
        path: '/recipes/new',
        element: <PlaceholderPage title="신규 레시피" stage="단계 1·3" />,
      },
      {
        path: '/recipes/draft/:draftId',
        element: <PlaceholderPage title="신규 레시피 (편집)" stage="단계 1·3" />,
      },
      {
        path: '/recipes',
        element: <PlaceholderPage title="레시피 목록" stage="단계 0.5" />,
      },
      {
        path: '/ingredients',
        element: <PlaceholderPage title="원료 마스터" stage="단계 1·2" />,
      },
      {
        path: '/presets',
        element: <PlaceholderPage title="프리셋 설정" stage="단계 0.5" />,
      },
      {
        path: '/orders',
        element: <PlaceholderPage title="발주" stage="단계 0.5" />,
      },
      {
        path: '/print',
        element: <PlaceholderPage title="PDF 출력" stage="단계 4" />,
      },
      {
        path: '/print/:recipeId',
        element: <PlaceholderPage title="PDF 출력" stage="단계 4" />,
      },
      {
        path: '/prices',
        element: <PlaceholderPage title="단가 관리" stage="단계 5 (생산앱 협의)" />,
      },
      {
        path: '/settings',
        element: <PlaceholderPage title="백업·복원" stage="단계 0.5·5" />,
      },
      {
        path: '*',
        element: <PlaceholderPage title="404" stage="잘못된 경로" />,
      },
    ],
  },
])
