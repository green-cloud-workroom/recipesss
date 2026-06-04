import { signInWithEmailAndPassword, signOut } from 'firebase/auth'

import { auth } from '../../firebase'

// 운영관리앱(fantapet-inventory)과 동일한 이메일/비번 패턴 mirror.
// 같은 fant-e5ae5 Auth 인스턴스라 호두님 계정은 운영관리앱과 동일.

export function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function logout() {
  return signOut(auth)
}
