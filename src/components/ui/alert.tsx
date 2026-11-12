import * as React from 'react'
import { cn } from '@/lib/utils'

type AlertProps = React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' }

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg~*]:pl-6',
        variant === 'destructive'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-[rgb(var(--border))] surface text-[rgb(var(--fg))]',
        className,
      )}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('font-semibold leading-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm opacity-90', className)} {...props} />
}
