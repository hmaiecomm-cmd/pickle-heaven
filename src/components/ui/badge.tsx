import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'surface-2 text-[rgb(var(--fg-muted))] border border-[rgb(var(--border))]',
        brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
        peak: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        offpeak: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        outline: 'border border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/** 訂單狀態徽章 */
const BOOKING_STATUS: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  PENDING: { label: '待付款', variant: 'warn' },
  PAID: { label: '已確認', variant: 'success' },
  COMPLETED: { label: '已完成', variant: 'neutral' },
  CANCELLED: { label: '已取消', variant: 'danger' },
  EXPIRED: { label: '已逾時', variant: 'neutral' },
  REFUND_PENDING: { label: '款項待退', variant: 'warn' },
}

export function BookingStatusBadge({ status }: { status: string }) {
  const s = BOOKING_STATUS[status] ?? { label: status, variant: 'neutral' as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}
