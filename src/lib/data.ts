/**
 * Couche d'accès aux données : TanStack Query + mises à jour optimistes + synchronisation temps réel.
 * Chaque table d'un voyage est mise en cache sous la clé ['t', tripId, table].
 */
import { useMemo } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { backend, type ChangeEvent } from './backend'
import type { TableMap, TableName, TripTable, Trip, TripMember, Profile } from './types'
import { uid } from './ids'

type AnyRow = Record<string, unknown> & { id: string }

export const qk = {
  table: (tripId: string, table: TripTable) => ['t', tripId, table] as const,
  trips: ['trips'] as const,
  allMembers: ['all-members'] as const,
  profiles: ['profiles'] as const,
}

function keyFor(table: TableName, row: AnyRow): readonly unknown[] | null {
  if (table === 'trips') return qk.trips
  if (table === 'profiles') return qk.profiles
  if (row.trip_id) return qk.table(row.trip_id as string, table as TripTable)
  return null
}

function upsertIn(list: AnyRow[] | undefined, row: AnyRow): AnyRow[] {
  if (!list) return [row]
  const i = list.findIndex((r) => r.id === row.id)
  if (i === -1) return [...list, row]
  const copy = list.slice()
  copy[i] = { ...copy[i], ...row }
  return copy
}

/** Applique une ligne (insert/update) dans tous les caches concernés */
export function cacheUpsert(qc: QueryClient, table: TableName, row: AnyRow) {
  const key = keyFor(table, row)
  if (key) qc.setQueryData<AnyRow[]>(key, (old) => (old ? upsertIn(old, row) : old))
  if (table === 'trip_members') qc.setQueryData<AnyRow[]>(qk.allMembers, (old) => (old ? upsertIn(old, row) : old))
  if (table === 'activity_log' && key) {
    qc.setQueryData<AnyRow[]>(key, (old) => (old ? [row, ...old.filter((r) => r.id !== row.id)] : old))
  }
}

/** Retire une ligne de tous les caches de la table (les DELETE temps réel ne donnent que l'id) */
export function cacheRemove(qc: QueryClient, table: TableName, id: string) {
  const strip = (old: AnyRow[] | undefined) => (old ? old.filter((r) => r.id !== id) : old)
  if (table === 'trips') qc.setQueryData<AnyRow[]>(qk.trips, strip)
  else if (table === 'profiles') qc.setQueryData<AnyRow[]>(qk.profiles, strip)
  else qc.setQueriesData<AnyRow[]>({ predicate: (q) => q.queryKey[0] === 't' && q.queryKey[2] === table }, strip)
  if (table === 'trip_members') qc.setQueryData<AnyRow[]>(qk.allMembers, strip)
}

export function applyChange(qc: QueryClient, e: ChangeEvent, myUserId: string | null) {
  if (e.type === 'DELETE') {
    const id = e.old?.id as string | undefined
    if (id) cacheRemove(qc, e.table, id)
    return
  }
  const row = e.row as AnyRow | undefined
  if (!row?.id) return
  if (e.table === 'activity_log') {
    cacheUpsert(qc, e.table, row)
    return
  }
  // un nouveau voyage dont on est membre : on recharge la liste
  if (e.table === 'trip_members' && row.user_id === myUserId && e.type === 'INSERT') {
    void qc.invalidateQueries({ queryKey: qk.trips })
  }
  cacheUpsert(qc, e.table, row)
}

// ---------------------------------------------------------------- lectures

export function useTripTable<T extends TripTable>(tripId: string | undefined, table: T) {
  return useQuery({
    queryKey: qk.table(tripId ?? '', table),
    queryFn: () =>
      table === 'activity_log'
        ? backend.select(table, { trip_id: tripId! }, { order: 'created_at', ascending: false, limit: 200 })
        : backend.select(table, { trip_id: tripId! }),
    enabled: !!tripId,
  }) as ReturnType<typeof useQuery<TableMap[T][]>>
}

export function useTrips() {
  return useQuery({ queryKey: qk.trips, queryFn: () => backend.select('trips') as Promise<Trip[]> })
}

export function useAllMembers() {
  return useQuery({ queryKey: qk.allMembers, queryFn: () => backend.select('trip_members') as Promise<TripMember[]> })
}

export function useProfiles() {
  return useQuery({ queryKey: qk.profiles, queryFn: () => backend.select('profiles') as Promise<Profile[]> })
}

// ---------------------------------------------------------------- écritures

function ensureOnline() {
  if (backend.mode === 'supabase' && typeof navigator !== 'undefined' && !navigator.onLine) {
    toast.error('Hors ligne : les modifications sont désactivées')
    throw new Error('offline')
  }
}

function report(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg === 'offline') return
  toast.error(/row-level security|autoris|permission/i.test(msg) ? "Tu n'as pas les droits pour cette action" : msg)
}

export interface Writer {
  insert<T extends TableName>(table: T, row: Partial<TableMap[T]>): Promise<TableMap[T]>
  insertMany<T extends TableName>(table: T, rows: Partial<TableMap[T]>[]): Promise<TableMap[T][]>
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>, tripId?: string): Promise<void>
  remove(table: TableName, id: string): Promise<void>
}

/** Écritures avec mise à jour optimiste du cache ; en cas d'erreur, on recharge depuis le serveur */
export function useWriter(userId: string | null | undefined): Writer {
  const qc = useQueryClient()
  return useMemo<Writer>(() => {
    const stamp = <R extends object>(row: R) => {
      const now = new Date().toISOString()
      return { id: uid(), created_at: now, updated_at: now, updated_by: userId ?? null, ...row } as unknown as AnyRow
    }
    const refetch = (table: TableName) =>
      qc.invalidateQueries({ predicate: (q) => q.queryKey.includes(table) || q.queryKey[0] === 'trips' })
    const findRow = (table: TableName, id: string): AnyRow | undefined => {
      for (const [, data] of qc.getQueriesData<AnyRow[]>({ predicate: (q) => q.queryKey.includes(table) || (table === 'trips' && q.queryKey[0] === 'trips') })) {
        const hit = data?.find?.((r) => r.id === id)
        if (hit) return hit
      }
      return undefined
    }
    return {
      async insertMany(table, rows) {
        ensureOnline()
        const full = rows.map(stamp)
        full.forEach((r) => cacheUpsert(qc, table, r))
        try {
          if (full.length) await backend.insert(table, full as never)
        } catch (err) {
          full.forEach((r) => cacheRemove(qc, table, r.id))
          report(err)
          throw err
        }
        return full as never
      },
      async insert(table, row) {
        const [r] = await this.insertMany(table, [row])
        return r
      },
      async update(table, id, patch) {
        ensureOnline()
        const existing = findRow(table, id)
        if (existing) cacheUpsert(qc, table, { ...existing, ...patch, updated_at: new Date().toISOString(), updated_by: userId ?? null } as AnyRow)
        try {
          await backend.update(table, id, patch as never)
        } catch (err) {
          void refetch(table)
          report(err)
          throw err
        }
      },
      async remove(table, id) {
        ensureOnline()
        const existing = findRow(table, id)
        cacheRemove(qc, table, id)
        try {
          await backend.remove(table, { id })
        } catch (err) {
          if (existing) cacheUpsert(qc, table, existing)
          report(err)
          throw err
        }
      },
    }
  }, [qc, userId])
}
