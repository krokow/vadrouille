import { cn } from '@/lib/utils'

export const APP_NAME = 'Vadrouille'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8', className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill="hsl(var(--primary))" />
      <path d="M14 44c8-3 12-14 18-24 6 10 10 21 18 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="18" r="6" fill="hsl(var(--coral))" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Logo />
      <span className="font-display text-xl font-bold tracking-tight">{APP_NAME}</span>
    </span>
  )
}
