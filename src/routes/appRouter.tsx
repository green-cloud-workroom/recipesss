import { createBrowserRouter } from 'react-router-dom'

import { AppLayout } from '../components/AppLayout'
import { AuthGuard } from '../components/AuthGuard'
import { LoginPage } from '../pages/LoginPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'

// SPEC §5.1 라우트 트리 + AuthGuard.
// 단계 0-C: 모든 인증된 라우트는 PlaceholderPage. 단계 0.5부터 실제 페이지로.

export const appRouter = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AuthGuard />,
    children: [
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
    ],
  },
])
