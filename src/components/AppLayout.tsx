import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { logout } from '../features/auth/authActions'
import { navigationGroups } from '../config/navigation'
import { useAuthStore } from '../stores/authStore'

// 운영관리앱 AppLayout 패턴 mirror (DL-021).
// 변경점:
//  - role 기반 메뉴 필터 제거 (DL-015 — 1인 사용)
//  - 푸터 = 이메일 + 로그아웃만, 역할 표시 없음 (DL-015)
//  - 메뉴 트리는 SPEC §5.1 / DL-024 / DL-026

export function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = () => setSidebarOpen(false)

  function handleLogout() {
    void logout()
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 md:flex-row">
      <header className="flex shrink-0 items-center border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <button
          aria-label="메뉴 열기"
          className="mr-3 text-gray-600 hover:text-gray-800"
          onClick={() => setSidebarOpen(true)}
          type="button"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M4 6h16M4 12h16M4 18h16"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </button>
        <span className="font-bold text-gray-800">레시피 계산기</span>
        <span className="ml-auto text-sm text-gray-500">
          {user?.email ?? ''}
        </span>
      </header>

      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out md:relative md:inset-auto md:z-auto md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <span className="block text-lg font-bold text-gray-800">
              레시피 계산기
            </span>
            <span className="text-[10px] text-gray-400">recipesss</span>
          </div>
          <button
            aria-label="메뉴 닫기"
            className="text-gray-400 hover:text-gray-600 md:hidden"
            onClick={closeSidebar}
            type="button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
        </div>

        <nav aria-label="주요 메뉴" className="flex-1 overflow-y-auto px-2 pb-4">
          {navigationGroups.map((group, groupIdx) => {
            if (group.collapsible === false && group.items.length === 1) {
              const item = group.items[0]
              if (!item) return null

              return (
                <div className={groupIdx > 0 ? 'mt-4' : ''} key={group.id}>
                  <NavLink
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                    end={item.path === '/'}
                    onClick={closeSidebar}
                    to={item.path}
                  >
                    {item.label}
                  </NavLink>
                </div>
              )
            }

            return (
              <div className={groupIdx > 0 ? 'mt-4' : ''} key={group.id}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          isActive
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                      end
                      key={`${group.id}-${item.path}`}
                      onClick={closeSidebar}
                      to={item.path}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-gray-200 p-3 text-sm">
          <div className="truncate text-gray-600">
            {user?.email ?? 'no email'}
          </div>
          <button
            className="mt-2 text-gray-500 hover:text-gray-800"
            onClick={handleLogout}
            type="button"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Suspense
          fallback={
            <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-400">
              로딩 중...
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
