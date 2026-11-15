import * as React from 'react'
import { cn } from '@/lib/utils'

const base =
  'flex w-full rounded-xl border border-input bg-card px-3 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(base, 'h-11 sm:h-10 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)} ref={ref} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea className={cn(base, 'min-h-[80px]', className)} ref={ref} {...props} />,
)
Textarea.displayName = 'Textarea'

/** Select natif stylé : meilleure ergonomie sur mobile que les listes custom */
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23889' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, style, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(base, 'h-11 appearance-none pr-9 sm:h-10', className)}
      style={{ backgroundImage: CHEVRON, backgroundSize: '16px', backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', ...style }}
      {...props}
    >
      {children}
    </select>
  ),
)
NativeSelect.displayName = 'NativeSelect'
