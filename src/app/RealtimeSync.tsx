import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { backend } from '@/lib/backend'
import { applyChange } from '@/lib/data'
import { useAuth } from '@/features/auth/AuthProvider'

/** Abonnement unique aux changements de la base : les caches se mettent à jour sans rechargement. */
export function RealtimeSync() {
  const qc = useQueryClient()
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    return backend.subscribe((e) => applyChange(qc, e, user.id))
  }, [qc, user])
  return null
}
