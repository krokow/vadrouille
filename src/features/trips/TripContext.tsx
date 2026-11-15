import { createContext, useContext, useMemo } from 'react'
import type { Role, Trip, TripMember } from '@/lib/types'
import { useWriter, type Writer } from '@/lib/data'

export interface TripCtx {
  trip: Trip
  members: TripMember[]
  me: TripMember | null
  role: Role
  canEdit: boolean
  isOwner: boolean
  memberById: Record<string, TripMember>
  /** auth user id → participant */
  memberByUser: Record<string, TripMember>
  writer: Writer
  userId: string
}

const Ctx = createContext<TripCtx | null>(null)

export function TripProvider({ trip, members, userId, children }: { trip: Trip; members: TripMember[]; userId: string; children: React.ReactNode }) {
  const writer = useWriter(userId)
  const value = useMemo<TripCtx>(() => {
    const sorted = [...members].sort((a, b) => {
      const rank = { owner: 0, editor: 1, viewer: 2 }
      return rank[a.role] - rank[b.role] || Number(a.is_ghost) - Number(b.is_ghost) || a.display_name.localeCompare(b.display_name)
    })
    const me = sorted.find((m) => m.user_id === userId) ?? null
    const role: Role = me?.role ?? 'viewer'
    const memberById: Record<string, TripMember> = {}
    const memberByUser: Record<string, TripMember> = {}
    for (const m of sorted) {
      memberById[m.id] = m
      if (m.user_id) memberByUser[m.user_id] = m
    }
    return { trip, members: sorted, me, role, canEdit: role !== 'viewer', isOwner: role === 'owner', memberById, memberByUser, writer, userId }
  }, [trip, members, userId, writer])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTrip(): TripCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTrip hors TripProvider')
  return v
}

export const ROLE_LABEL: Record<Role, string> = { owner: 'Organisateur', editor: 'Éditeur', viewer: 'Lecteur' }
