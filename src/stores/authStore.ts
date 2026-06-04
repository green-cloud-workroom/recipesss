import type { User } from 'firebase/auth'
import { create } from 'zustand'

import type { AuthStatus } from '../types/auth'

// 1인 사용 (DL-015) — role/claim 없음. user 존재 여부만으로 인증 판단.

type AuthStore = {
  user: User | null
  status: AuthStatus
  error: string | null
  setAuthenticated: (user: User) => void
  setUnauthenticated: () => void
  setError: (error: string) => void
  setInitializing: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  status: 'initializing',
  error: null,
  setAuthenticated: (user) => set({ user, status: 'authenticated', error: null }),
  setUnauthenticated: () => set({ user: null, status: 'unauthenticated', error: null }),
  setError: (error) => set({ user: null, status: 'unauthenticated', error }),
  setInitializing: () => set({ status: 'initializing' }),
}))
