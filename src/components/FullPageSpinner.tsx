import { Logo } from './Logo'

export function FullPageSpinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 paper" role="status" aria-live="polite">
      <Logo className="h-12 w-12 animate-bounce" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
