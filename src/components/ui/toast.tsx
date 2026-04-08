'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: string
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // No-op fallback so components don't crash when rendered outside
    // the provider (e.g. unit tests). They just won't surface toasts.
    const noop = () => {}
    return {
      show: noop,
      success: noop,
      error: noop,
      info: noop,
    }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { id, kind, message }])
    },
    []
  )

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport — fixed top-right, above everything */}
      <div
        className="pointer-events-none fixed top-20 right-4 md:right-6 flex flex-col gap-3"
        style={{ zIndex: 80 }}
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: () => void
}) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setLeaving(true), 2800)
    const removeTimer = setTimeout(onDismiss, 3000)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(removeTimer)
    }
  }, [onDismiss])

  const { icon, borderColor, iconColor } = styleFor(toast.kind)

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto glass-panel-sm flex items-start gap-3 pl-4 pr-4 py-3 min-w-[260px] max-w-[360px]',
        leaving ? 'kst-toast-out' : 'kst-toast-in'
      )}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: iconColor }}>
        {icon}
      </span>
      <p className="text-sm text-kst-white leading-snug break-words">
        {toast.message}
      </p>
    </div>
  )
}

function styleFor(kind: ToastKind): {
  icon: ReactNode
  borderColor: string
  iconColor: string
} {
  switch (kind) {
    case 'success':
      return {
        icon: <CheckCircle size={16} />,
        borderColor: 'rgba(52, 211, 153, 0.8)',
        iconColor: '#34D399',
      }
    case 'error':
      return {
        icon: <XCircle size={16} />,
        borderColor: 'rgba(248, 113, 113, 0.8)',
        iconColor: '#F87171',
      }
    default:
      return {
        icon: <Info size={16} />,
        borderColor: 'rgba(201, 168, 76, 0.8)',
        iconColor: '#C9A84C',
      }
  }
}
