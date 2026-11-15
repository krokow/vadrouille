import * as React from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}

const ConfirmContext = React.createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = React.useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  )
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={!!state} onOpenChange={(o) => !o && close(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border bg-background p-5 shadow-xl">
            <AlertDialog.Title className="font-display text-lg font-semibold">{state?.title}</AlertDialog.Title>
            {state?.description && (
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{state.description}</AlertDialog.Description>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost">Annuler</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant={state?.destructive ? 'destructive' : 'default'} onClick={() => close(true)}>
                  {state?.confirmLabel ?? 'Confirmer'}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => React.useContext(ConfirmContext)
