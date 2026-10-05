'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

const Overlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-[2px] animate-fade-in', className)}
    {...props}
  />
))
Overlay.displayName = 'SheetOverlay'

/**
 * 手機為底部彈出（bottom sheet），桌機為置中對話框。
 * 同一個元件同時服務兩種版型，避免維護兩套。
 */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(({ className, children, title, description, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 surface shadow-pop animate-slide-up',
        // 手機：貼底
        'inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl',
        // 桌機：置中
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(32rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
        className,
      )}
      {...props}
    >
      <div className="sticky top-0 z-10 surface border-b border-[rgb(var(--border))] px-4 pb-3 pt-4 sm:px-5">
        {/* 手機上的拖曳提示條 */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[rgb(var(--border))] sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[rgb(var(--fg-muted))] transition-colors hover:surface-2"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </div>
      </div>
      <div className="px-4 pb-6 pt-4 pb-safe sm:px-5">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'
