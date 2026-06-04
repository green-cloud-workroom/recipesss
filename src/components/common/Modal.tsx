import type { ReactNode } from 'react'

import { PRIMARY_BTN_CLS, SECONDARY_BTN_CLS } from '../../lib/ui'

type ModalProps = {
  title: string
  onClose: () => void
  onSave?: () => void
  saving?: boolean
  saveLabel?: string
  cancelLabel?: string
  children: ReactNode
  /** 기본 취소/저장 영역 대신 직접 렌더링할 footer. */
  footer?: ReactNode
}

export function Modal({
  title,
  onClose,
  onSave,
  saving = false,
  saveLabel = '저장',
  cancelLabel = '취소',
  children,
  footer,
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          {footer ?? (
            <>
              <button
                className={SECONDARY_BTN_CLS}
                onClick={onClose}
                type="button"
              >
                {cancelLabel}
              </button>
              {onSave && (
                <button
                  className={PRIMARY_BTN_CLS}
                  disabled={saving}
                  onClick={onSave}
                  type="button"
                >
                  {saving ? '저장 중...' : saveLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
