import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import App from './App.tsx'
import { startAuthBootstrap } from './features/auth/authBootstrap'

// Firebase Auth 상태 구독 시작 — 라우터 마운트 전 필수.
startAuthBootstrap()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
