import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingScreen } from './LoadingScreen'
import { useAuthStore } from '../stores/authStore'

// status='initializing' → 로딩 화면
// status='unauthenticated' → /login 으로 redirect (현 위치 state로 기억)
// status='authenticated' → 통과 (자식 라우트 렌더링)

export function AuthGuard() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'initializing') {
    return <LoadingScreen />
  }
  if (status === 'unauthenticated') {
    return <Navigate replace state={{ from: location }} to="/login" />
  }
  return <Outlet />
}
