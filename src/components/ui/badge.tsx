import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'bg-primary/10 text-primary',
      secondary: 'bg-secondary text-secondary-foreground',
      coral: 'bg-coral/15 text-coral',
      warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
      destructive: 'bg-destructive/15 text-destructive',
      success: 'bg-success/15 text-success',
      outline: 'border border-border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
