import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { loginWithEmail } from '../features/auth/authActions'
import { useAuthStore } from '../stores/authStore'
import { PRIMARY_BTN_CLS, INPUT_CLS } from '../lib/ui'

type LocationState = { from?: { pathname: string } }

export function LoginPage() {
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const authError = useAuthStore((state) => state.error)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  if (status === 'authenticated') {
    return <Navigate replace to={from} />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await loginWithEmail(email, password)
    } catch {
      setSubmitError('로그인 실패. 이메일과 비밀번호를 확인하세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 font-sans">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-gray-800">레시피 계산기</h1>
          <p className="mt-1 text-helper text-gray-500">fant-e5ae5 Firebase Auth</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div>
            <label
              className="mb-1 block text-helper font-medium text-gray-700"
              htmlFor="email"
            >
              이메일
            </label>
            <input
              autoComplete="email"
              className={INPUT_CLS}
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-helper font-medium text-gray-700"
              htmlFor="password"
            >
              비밀번호
            </label>
            <input
              autoComplete="current-password"
              className={INPUT_CLS}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {(authError ?? submitError) && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-helper text-red-700">
              {authError ?? submitError}
            </div>
          )}

          <button
            className={`${PRIMARY_BTN_CLS} w-full`}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '확인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-4 text-center text-caption text-gray-400">
          운영관리앱·생산관리앱과 동일 계정.
        </p>
      </div>
    </main>
  )
}

export default LoginPage
