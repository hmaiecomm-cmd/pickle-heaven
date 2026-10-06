'use client'

interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
}

const statusColors: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400' },
  warning: { bg: 'bg-amber-100 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400' },
  error: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400' },
  info: { bg: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400' },
  default: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' },
}

const statusMap: Record<string, keyof typeof statusColors> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'error',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error',
  ACTIVE: 'success',
  INACTIVE: 'error',
  ONLINE: 'success',
  OFFLINE: 'error',
  DRAFT: 'info',
  PUBLISHED: 'success',
  ONGOING: 'info',
}

export function StatusBadge({ status, variant, size = 'md' }: StatusBadgeProps) {
  const resolvedVariant = variant || statusMap[status] || 'default'
  const colors = statusColors[resolvedVariant]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${size === 'sm' ? 'text-[10px]' : ''}`}
    >
      {status}
    </span>
  )
}

export function EmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-4xl">{icon}</div>}
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ message = '載入中...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400" />
      <p className="mt-4 text-sm text-muted">{message}</p>
    </div>
  )
}

export function ErrorState({ title = '發生錯誤', description, retry }: { title?: string; description?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {retry && (
        <button onClick={retry} className="mt-4 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          重試
        </button>
      )}
    </div>
  )
}
