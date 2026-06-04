import { useEffect } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastMessage = {
  id: string
  message: string
  tone: ToastTone
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const toneCls = {
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-gray-200 bg-gray-50 text-gray-700',
    success: 'border-green-200 bg-green-50 text-green-800',
  }[toast.tone]

  return (
    <div
      className={`rounded-lg border px-4 py-2 text-sm shadow-md ${toneCls}`}
      role="status"
    >
      {toast.message}
    </div>
  )
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div className="pointer-events-auto" key={toast.id}>
          <Toast onDismiss={onDismiss} toast={toast} />
        </div>
      ))}
    </div>
  )
}
