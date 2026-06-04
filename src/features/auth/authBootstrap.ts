import { onAuthStateChanged } from 'firebase/auth'

import { auth } from '../../firebase'
import { useAuthStore } from '../../stores/authStore'

// main.tsx 부팅 시 1회 호출. Firebase Auth 상태 변화를 store에 반영.

export function startAuthBootstrap(): () => void {
  useAuthStore.getState().setInitializing()

  return onAuthStateChanged(
    auth,
    (user) => {
      if (user) {
        useAuthStore.getState().setAuthenticated(user)
      } else {
        useAuthStore.getState().setUnauthenticated()
      }
    },
    (error) => {
      useAuthStore.getState().setError(error.message)
    },
  )
}
