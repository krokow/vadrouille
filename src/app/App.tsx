import { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster, toast } from 'sonner'
import { queryClient, persister } from '@/lib/queryClient'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ConfirmProvider } from '@/components/ui/confirm'
import { RealtimeSync } from './RealtimeSync'
import { AppRoutes } from './routes'
import { useTheme } from './theme'

export function App({ authError }: { authError?: string | null }) {
  const { theme } = useTheme()
  useEffect(() => {
    if (authError) toast.error(`Connexion impossible : ${authError}. Redemande un lien.`)
  }, [authError])
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v1' }}
    >
      <HashRouter>
        <AuthProvider>
          <ConfirmProvider>
            <RealtimeSync />
            <AppRoutes />
          </ConfirmProvider>
        </AuthProvider>
      </HashRouter>
      <Toaster position="top-center" richColors closeButton theme={theme} toastOptions={{ className: 'rounded-2xl' }} />
    </PersistQueryClientProvider>
  )
}
