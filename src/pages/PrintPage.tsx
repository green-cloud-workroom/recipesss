import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useIngredients } from '../features/ingredients/ingredientQueries'
import { usePresets } from '../features/presets/presetQueries'
import { OrderPdf1, OrderPdf2 } from '../features/print/OrderPdf'
import {
  buildOutputOne,
  buildOutputTwo,
  buildPresetPrintViews,
} from '../features/print/printSelectors'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import { EMPTY_STATE_CLS, PRIMARY_BTN_CLS } from '../lib/ui'
import { useAuthStore } from '../stores/authStore'

type PrintTab = 'view1' | 'view2'

export function PrintPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const [searchParams] = useSearchParams()
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const ingredientsQuery = useIngredients(uid)
  const [tab, setTab] = useState<PrintTab>('view1')

  const selectedIds = useMemo(
    () => (searchParams.get('presets') ?? '').split(',').filter(Boolean),
    [searchParams],
  )

  const isLoading =
    draftsQuery.isLoading || presetsQuery.isLoading || ingredientsQuery.isLoading

  const views = useMemo(
    () =>
      buildPresetPrintViews(
        selectedIds,
        presetsQuery.data ?? [],
        draftsQuery.data ?? [],
        ingredientsQuery.data ?? [],
      ),
    [selectedIds, presetsQuery.data, draftsQuery.data, ingredientsQuery.data],
  )
  const outputOne = useMemo(() => buildOutputOne(views), [views])
  const outputTwo = useMemo(() => buildOutputTwo(views), [views])

  const doc =
    tab === 'view1' ? (
      <OrderPdf1 groups={outputOne} />
    ) : (
      <OrderPdf2 output={outputTwo} />
    )
  const fileName = tab === 'view1' ? '발주_출력1.pdf' : '발주_출력2.pdf'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-gray-800">PDF 출력</h1>
          <p className="mt-1 text-helper text-gray-500">
            발주에서 선택한 프리셋 {selectedIds.length}개 · 출력 1(난각분) ·
            출력 2(영양제 치환명)
          </p>
        </div>
        <Link className="text-sm text-gray-500 hover:text-gray-800" to="/orders">
          ← 발주로 돌아가기
        </Link>
      </div>

      {selectedIds.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          발주 탭에서 프리셋을 선택해 주세요.
        </div>
      )}

      {selectedIds.length > 0 && isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {selectedIds.length > 0 && !isLoading && views.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          선택한 프리셋을 찾을 수 없습니다.
        </div>
      )}

      {selectedIds.length > 0 && !isLoading && views.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
              {(
                [
                  ['view1', '출력 1'],
                  ['view2', '출력 2'],
                ] as Array<[PrintTab, string]>
              ).map(([value, label]) => (
                <button
                  className={
                    tab === value
                      ? 'bg-gray-800 px-4 py-2 text-white'
                      : 'bg-white px-4 py-2 text-gray-600 hover:bg-gray-50'
                  }
                  key={value}
                  onClick={() => setTab(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <PDFDownloadLink
              className={PRIMARY_BTN_CLS}
              document={doc}
              fileName={fileName}
            >
              {({ loading }) => (loading ? '생성 중...' : 'PDF 다운로드')}
            </PDFDownloadLink>
          </div>

          <div className="mt-4 h-[75vh] overflow-hidden rounded-lg shadow-sm">
            <PDFViewer
              key={tab}
              showToolbar
              style={{ border: 0, height: '100%', width: '100%' }}
            >
              {doc}
            </PDFViewer>
          </div>
        </>
      )}
    </div>
  )
}

export default PrintPage
