'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium', className)} {...props}>
    {children}
    {required && <span className="ml-0.5 text-red-500">*</span>}
  </LabelPrimitive.Root>
))
Label.displayName = 'Label'

const controlClass =
  'w-full rounded-xl border border-[rgb(var(--border))] surface px-3.5 text-[15px] placeholder:text-[rgb(var(--fg-muted))] transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:opacity-60'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    // 字級 16px 以上可避免 iOS Safari 聚焦時自動放大
    <input ref={ref} className={cn(controlClass, 'h-12', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlClass, 'min-h-[88px] py-3', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
