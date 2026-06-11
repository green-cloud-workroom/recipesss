import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { countExistingDocs } from '../features/migration/runMigration'
import {
  buildOrderSummary,
  filterOrderGroups,
  formatOrderLine,
  formatPresetInput,
  groupPresetsByRecipe,
  speciesLabel,
  totalSelectedCount,
  type OrderFilter,
  type OrderGroup,
  type OrderSelection,
} from '../features/orders/orderSelectors'
import { usePresets } from '../features/presets/presetQueries'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { CARD_CLS, EMPTY_STATE_CLS, PRIMARY_BTN_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { Preset, RecipeDraft } from '../types/recipe'

const EMPTY_DRAFTS: RecipeDraft[] = []
const EMPTY_PRESETS: Preset[] = []
const ORDER_FILTERS: Array<{ value: OrderFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'cat', label: '고양이' },
  { value: 'dog', label: '강아지' },
  { value: 'freezeDried', label: '동결건조' },
]

export function OrdersPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const diagnosticsQuery = useQuery({
    queryKey: ['recipesssCounts', uid],
    queryFn: () => countExistingDocs(uid as string),
    enabled: !!uid,
  })
  const [selection, setSelection] = useState<OrderSelection>({})
  const [filter, setFilter] = useState<OrderFilter>('all')

  const drafts = draftsQuery.data ?? EMPTY_DRAFTS
  const presets = presetsQuery.data ?? EMPTY_PRESETS
  const groups = useMemo(
    () => groupPresetsByRecipe(drafts, presets),
    [drafts, presets],
  )
  const filteredGroups = useMemo(
    () => filterOrderGroups(groups, filter),
    [filter, groups],
  )
  const summary = useMemo(
    () => buildOrderSummary(filteredGroups, selection),
    [filteredGroups, selection],
  )

  const isLoading = draftsQuery.isLoading || presetsQuery.isLoading
  const isError = draftsQuery.isError || presetsQuery.isError
  const queryError = draftsQuery.error ?? presetsQuery.error
  const selectedCount = totalSelectedCount(selection)

  function togglePreset(presetId: string, checked: boolean) {
    setSelection((prev) => {
      if (checked) return { ...prev, [presetId]: true }

      const next = { ...prev }
      delete next[presetId]
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-bold text-gray-800">발주</h1>
          <p className="mt-1 text-helper text-gray-500">
            프리셋을 선택해 이번 회차 발주 목록을 만듭니다.
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
          선택 {selectedCount}개
        </div>
      </div>

      {isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {isError && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {queryError instanceof Error
            ? queryError.message
            : '발주 데이터를 불러오지 못했습니다.'}
        </div>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          발주할 프리셋이 없습니다.
          <OrderDiagnostics
            counts={diagnosticsQuery.data}
            isLoading={diagnosticsQuery.isLoading}
            uid={uid}
          />
        </div>
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {ORDER_FILTERS.map((item) => (
              <button
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  filter === item.value
                    ? 'border-gray-800 bg-gray-800 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
                key={item.value}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-2">
              {filteredGroups.length === 0 ? (
                <div className={EMPTY_STATE_CLS}>
                  선택한 조건에 맞는 프리셋이 없습니다.
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <OrderGroupCard
                    group={group}
                    key={group.draftId}
                    onToggle={togglePreset}
                    selection={selection}
                  />
                ))
              )}
            </div>

            <aside className={`${CARD_CLS} self-start`}>
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  발주 요약
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  선택한 프리셋
                </p>
              </div>

              {summary.length === 0 ? (
                <div className="p-6 text-sm text-gray-400">
                  프리셋을 선택하세요.
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {summary.map((group) => (
                    <div
                      className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700"
                      key={group.draftId}
                    >
                      {formatOrderLine(group)}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-100 p-4">
                <button
                  className={`${PRIMARY_BTN_CLS} w-full`}
                  disabled
                  title="단계 4에서 구현"
                  type="button"
                >
                  출력 미리보기 생성 (단계 4)
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function OrderDiagnostics({
  counts,
  isLoading,
  uid,
}: {
  counts:
    | { recipeDrafts: number; ingredients: number; presets: number }
    | undefined
  isLoading: boolean
  uid: string | undefined
}) {
  return (
    <div className="mx-auto mt-4 max-w-xl rounded-md bg-gray-50 px-3 py-2 text-left text-xs text-gray-500">
      <div>현재 uid: {uid ?? '-'}</div>
      {isLoading || !counts ? (
        <div className="mt-1">문서 수 확인 중...</div>
      ) : (
        <div className="mt-1">
          recipeDrafts {counts.recipeDrafts} / presets {counts.presets} /
          ingredients {counts.ingredients}
        </div>
      )}
    </div>
  )
}

function OrderGroupCard({
  group,
  onToggle,
  selection,
}: {
  group: OrderGroup
  onToggle: (presetId: string, checked: boolean) => void
  selection: OrderSelection
}) {
  return (
    <section className={CARD_CLS}>
      <div className="flex flex-col gap-1 border-b border-gray-100 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          ({speciesLabel(group.species)}){group.draftName}
        </h2>
        <span className="text-xs text-gray-400">
          프리셋 {group.presets.length}개
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-2">
        {group.presets.map((preset) => {
          const checked = Object.prototype.hasOwnProperty.call(
            selection,
            preset.id,
          )

          return (
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
                checked
                  ? 'border-gray-800 bg-gray-800 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              key={preset.id}
            >
              <input
                checked={checked}
                className="h-4 w-4 rounded border-gray-300"
                onChange={(event) => onToggle(preset.id, event.target.checked)}
                type="checkbox"
              />
              <span className="font-medium">{preset.code}</span>
              <span className={checked ? 'text-gray-200' : 'text-gray-500'}>
                {formatPresetInput(preset)}
              </span>
              {preset.label && (
                <span
                  className={checked ? 'text-gray-200' : 'text-gray-500'}
                >
                  {preset.label}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </section>
  )
}

export default OrdersPage
