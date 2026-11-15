import { createContext, lazy, Suspense, useCallback, useContext, useState } from 'react'

export type QuickKind = 'activity' | 'booking' | 'expense' | 'quick-expense'
export interface QuickAddState {
  kind: QuickKind
  /** id d'un élément existant à modifier */
  id?: string
  defaults?: Record<string, unknown>
}

const ActivityDialog = lazy(() => import('@/features/activities/ActivityDialog'))
const BookingDialog = lazy(() => import('@/features/bookings/BookingDialog'))
const ExpenseDialog = lazy(() => import('@/features/budget/ExpenseDialog'))
const QuickExpenseDialog = lazy(() => import('@/features/budget/QuickExpenseDialog'))

const Ctx = createContext<(s: QuickAddState) => void>(() => undefined)

/** Ouvre les formulaires d'ajout / d'édition depuis n'importe où dans un voyage */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuickAddState | null>(null)
  const open = useCallback((s: QuickAddState) => setState(s), [])
  const close = () => setState(null)
  return (
    <Ctx.Provider value={open}>
      {children}
      <Suspense fallback={null}>
        {state?.kind === 'activity' && <ActivityDialog id={state.id} defaults={state.defaults} onClose={close} />}
        {state?.kind === 'booking' && <BookingDialog id={state.id} defaults={state.defaults} onClose={close} />}
        {state?.kind === 'expense' && <ExpenseDialog key={JSON.stringify(state.defaults ?? {})} id={state.id} defaults={state.defaults} onClose={close} />}
        {state?.kind === 'quick-expense' && <QuickExpenseDialog onClose={close} />}
      </Suspense>
    </Ctx.Provider>
  )
}

export const useQuickAdd = () => useContext(Ctx)
