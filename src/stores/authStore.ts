import type { User } from 'firebase/auth'
import { create } from 'zustand'

// 단계 0-B: 골격만. Firebase onAuthStateChanged 구독은 단계 0 후속(또는 0.5)에서 연결.
// DL-015: 1인 사용 — role 없음. 이메일 + 로그아웃만 사이드바 푸터.

type AuthState = {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
}))
