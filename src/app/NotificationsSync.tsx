import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { backend } from '@/lib/backend'
import { qk } from '@/lib/data'
import { describeChange, notifyEnabled, showSystemNotification } from '@/lib/notify'
import { pushActiveHere } from '@/lib/push'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ActivityLogEntry, Comment, Trip, TripMember } from '@/lib/types'

/**
 * Notifications « locales » : quand l'app est ouverte (ou en arrière-plan sur ordinateur),
 * prévient des modifications faites par les autres et des @mentions.
 * Si le Web Push est actif sur cet appareil, le serveur s'en charge (pas de doublon).
 */
export function NotificationsSync() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  useEffect(() => {
    if (!user) return
    const memberName = (tripId: string, userId: string | null) => {
      const lists = [qc.getQueryData<TripMember[]>(qk.table(tripId, 'trip_members')), qc.getQueryData<TripMember[]>(qk.allMembers)]
      for (const l of lists) {
        const m = l?.find((x) => x.trip_id === tripId && x.user_id === userId)
        if (m) return m.display_name
      }
      return 'Quelqu’un'
    }
    const tripName = (id: string) => qc.getQueryData<Trip[]>(qk.trips)?.find((t) => t.id === id)?.name ?? 'Vadrouille'
    return backend.subscribe((e) => {
      if (e.type !== 'INSERT' || !e.row) return
      if (e.table === 'comments') {
        const c = e.row as unknown as Comment
        const me = profile?.display_name
        if (c.author_id !== user.id && me && c.body.includes(`@${me}`)) {
          const who = memberName(c.trip_id, c.author_id)
          toast(`💬 ${who} t’a mentionné`, { description: c.body.slice(0, 120) })
          if (document.visibilityState === 'hidden' && !pushActiveHere()) void showSystemNotification(`${who} t’a mentionné`, c.body.slice(0, 140), { url: `#/t/${c.trip_id}`, tag: `mention-${c.id}` })
        }
        return
      }
      if (e.table !== 'activity_log') return
      const log = e.row as unknown as ActivityLogEntry
      if (!log.actor_id || log.actor_id === user.id || document.visibilityState !== 'hidden' || pushActiveHere() || !notifyEnabled()) return
      void showSystemNotification(tripName(log.trip_id), describeChange(memberName(log.trip_id, log.actor_id), log.action, log.entity_type, log.payload?.title), {
        url: `#/t/${log.trip_id}/history`, tag: `log-${log.trip_id}`,
      })
    })
  }, [qc, user, profile?.display_name])
  return null
}
