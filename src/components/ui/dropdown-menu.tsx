import * as React from 'react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DM.Content>,
  React.ComponentPropsWithoutRef<typeof DM.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DM.Portal>
    <DM.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[12rem] overflow-hidden rounded-2xl border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    />
  </DM.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DM.Item>,
  React.ComponentPropsWithoutRef<typeof DM.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DM.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4',
      destructive && 'text-destructive focus:bg-destructive/10',
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuSeparator = () => <DM.Separator className="-mx-1 my-1 h-px bg-border" />
export const DropdownMenuLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-3 py-1.5 text-xs font-semibold text-muted-foreground', className)} {...props} />
)
