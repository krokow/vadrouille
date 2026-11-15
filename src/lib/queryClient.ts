import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // gardé 7 jours pour la consultation hors ligne
      retry: (count, err) => count < 2 && !(err instanceof Error && /autoris|permission|JWT/i.test(err.message)),
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'always' },
  },
})

/** Les derniers voyages chargés sont persistés pour la lecture hors ligne (PWA) */
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'vadrouille-cache',
  throttleTime: 2000,
})
