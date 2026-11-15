import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/** Sur mobile : panneau qui monte depuis le bas ; sur desktop : fenêtre centrée */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }
>(({ className, children, wide, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden border bg-background shadow-xl duration-200',
        'inset-x-0 bottom-0 rounded-t-3xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
        'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden />
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <X className="h-5 w-5" />
        <span className="sr-only">Fermer</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('shrink-0 px-5 pb-2 pt-3 pr-12 sm:pt-5', className)} {...props} />
)
export const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto px-5 pb-4', className)} {...props} />
)
export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end', className)} {...props} />
)
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('font-display text-xl font-semibold', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = 'DialogDescription'
