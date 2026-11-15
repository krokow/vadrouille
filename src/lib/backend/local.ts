/**
 * Backend « mode démo » : tout est stocké dans le navigateur (localStorage).
 * Il imite les triggers et les politiques RLS principales de la base Supabase
 * pour que l'app soit utilisable (et testable) sans projet Supabase.
 * La synchronisation entre onglets passe par BroadcastChannel.
 */
import type { Backend, AuthUser, ChangeEvent, Match, PresenceUser } from './types'
import type { TableName, TripMember, Trip } from '../types'
import { TRIP_TABLES } from '../types'
import { colorFor, uid } from '../ids'

type Row = Record<string, unknown> & { id: string }
type DB = Record<string, Row[]>

const DB_KEY = 'vadrouille-demo-db'
const FILES_KEY = 'vadrouille-demo-files'
const USER_KEY = 'vadrouille-demo-user'

const LOGGED: TableName[] = ['options', 'activities', 'bookings', 'expenses', 'trip_members', 'settlements', 'comments', 'places', 'budgets', 'checklist_items', 'journal_entries']

function load(): DB {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '{}') as DB
  } catch {
    return {}
  }
}

export function createLocalBackend(): Backend {
  let db: DB = load()
  // les événements sont diffusés APRÈS l'écriture, sinon un rechargement déclenché par l'événement lirait l'ancien état
  let pending: ChangeEvent[] = []
  const save = () => {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
    const events = pending
    pending = []
    events.forEach((e) => dispatch(e))
  }
  const rows = (t: string) => (db[t] ??= [])
  const authListeners = new Set<(u: AuthUser | null) => void>()
  const changeListeners = new Set<(e: ChangeEvent) => void>()
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vadrouille-demo') : null

  const getSessionUser = (): AuthUser | null => {
    try {
      const raw = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  }
  let current = getSessionUser()

  const dispatch = (e: ChangeEvent, broadcast = true) => {
    changeListeners.forEach((l) => l(e))
    if (broadcast) bc?.postMessage({ kind: 'change', e })
  }
  const emit = (e: ChangeEvent) => {
    pending.push(structuredClone(e))
  }
  bc?.addEventListener('message', (msg) => {
    const data = msg.data as { kind: string; e?: ChangeEvent }
    if (data.kind === 'change' && data.e) {
      db = load()
      dispatch(data.e, false)
    }
  })

  const now = () => new Date().toISOString()
  const memberOf = (tripId: unknown): TripMember | undefined =>
    current ? (rows('trip_members') as unknown as TripMember[]).find((m) => m.trip_id === tripId && m.user_id === current!.id) : undefined
  const canEdit = (tripId: unknown) => {
    const m = memberOf(tripId)
    return !!m && (m.role === 'owner' || m.role === 'editor')
  }
  const isOwner = (tripId: unknown) => memberOf(tripId)?.role === 'owner'
  const deny = () => {
    throw new Error('Action non autorisée (droits insuffisants)')
  }

  const visible = (table: string, r: Row): boolean => {
    if (!current) return false
    if (table === 'trips') return !!memberOf(r.id)
    if (table === 'profiles') return true
    if (table === 'push_subscriptions') return r.user_id === current.id
    if (table === 'documents') return !!memberOf(r.trip_id) && (r.visibility === 'trip' || r.owner_id === current.id)
    return !!memberOf(r.trip_id)
  }

  const guardWrite = (table: string, r: Row, op: 'insert' | 'update' | 'delete') => {
    if (!current) deny()
    if (table === 'profiles') return r.id === current!.id || deny()
    if (table === 'trips') {
      if (op === 'insert') return r.created_by === current!.id || deny()
      if (op === 'delete') return isOwner(r.id) || deny()
      return canEdit(r.id) || deny()
    }
    if (table === 'trip_members') return isOwner(r.trip_id) || (op === 'delete' && r.user_id === current!.id) || deny()
    if (table === 'push_subscriptions') return r.user_id === current!.id || deny()
    if (table === 'comments' || table === 'activity_votes' || table === 'option_votes') return !!memberOf(r.trip_id) || deny()
    if (table === 'documents') return (!!memberOf(r.trip_id) && r.owner_id === current!.id) || deny()
    if (table === 'activity_log') return deny()
    return canEdit(r.trip_id) || deny()
  }

  const log = (table: TableName, action: 'insert' | 'update' | 'delete', r: Row) => {
    if (!LOGGED.includes(table) || !r.trip_id) return
    const title = (r.title ?? r.name ?? r.display_name ?? r.label ?? r.body ?? '') as string
    const last = rows('activity_log').at(-1)
    // regroupe les modifications successives du même élément par la même personne (2 min)
    if (
      action === 'update' && last && last.entity_id === r.id && last.actor_id === current?.id &&
      Date.now() - new Date(last.created_at as string).getTime() < 120_000
    ) {
      last.created_at = now()
      return
    }
    const entry: Row = {
      id: uid(), created_at: now(), trip_id: r.trip_id, actor_id: current?.id ?? null,
      action, entity_type: table, entity_id: r.id, payload: { title: String(title).slice(0, 80) },
    }
    rows('activity_log').push(entry)
    emit({ table: 'activity_log', type: 'INSERT', row: entry })
  }

  const doInsert = (table: TableName, input: Record<string, unknown>, skipGuard = false) => {
    const r = { id: uid(), created_at: now(), updated_at: now(), updated_by: current?.id ?? null, ...input } as Row
    if (!skipGuard) guardWrite(table, r, 'insert')
    if (rows(table).some((x) => x.id === r.id)) throw new Error('duplicate key')
    rows(table).push(r)
    emit({ table, type: 'INSERT', row: r })
    log(table, 'insert', r)
    // trigger : le créateur devient organisateur
    if (table === 'trips' && current) {
      const profile = rows('profiles').find((p) => p.id === current!.id)
      doInsert('trip_members', {
        trip_id: r.id, user_id: current.id, role: 'owner', is_ghost: false,
        display_name: profile?.display_name ?? 'Moi', color: profile?.color ?? colorFor(current.id),
      }, true)
    }
    return r
  }

  const removeWhere = (table: TableName, pred: (r: Row) => boolean) => {
    const victims = rows(table).filter(pred)
    db[table] = rows(table).filter((r) => !pred(r))
    for (const v of victims) {
      emit({ table, type: 'DELETE', old: { id: v.id, trip_id: v.trip_id } })
      log(table, 'delete', v)
    }
    return victims
  }

  const matches = (r: Row, m?: Match) => Object.entries(m ?? {}).every(([k, v]) => (r[k] ?? null) === v)

  const setUser = (email: string) => {
    const normalized = email.trim().toLowerCase()
    let profile = rows('profiles').find((p) => p.email === normalized)
    if (!profile) {
      const id = uid()
      profile = {
        id, email: normalized, created_at: now(), updated_at: now(),
        display_name: normalized.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        avatar_url: null, color: colorFor(id), preferred_currency: 'EUR',
      }
      rows('profiles').push(profile)
      save()
    }
    current = { id: profile.id, email: normalized }
    const raw = JSON.stringify(current)
    sessionStorage.setItem(USER_KEY, raw)
    localStorage.setItem(USER_KEY, raw)
    authListeners.forEach((l) => l(current))
  }

  return {
    mode: 'local',
    async getUser() {
      return current
    },
    onAuthChange(cb) {
      authListeners.add(cb)
      return () => authListeners.delete(cb)
    },
    async sendMagicLink(email) {
      await new Promise((r) => setTimeout(r, 300))
      setUser(email)
    },
    async verifyCode(email) {
      setUser(email)
    },
    async signOut() {
      current = null
      sessionStorage.removeItem(USER_KEY)
      localStorage.removeItem(USER_KEY)
      authListeners.forEach((l) => l(null))
    },
    async select(table, match, opts) {
      db = load()
      let out = rows(table).filter((r) => visible(table, r) && matches(r, match))
      if (opts?.order) {
        const k = opts.order
        const dir = opts.ascending === false ? -1 : 1
        out = [...out].sort((a, b) => (String(a[k] ?? '') < String(b[k] ?? '') ? -dir : dir))
      }
      if (opts?.limit) out = out.slice(0, opts.limit)
      return structuredClone(out) as never
    },
    async insert(table, input) {
      db = load()
      const list = Array.isArray(input) ? input : [input]
      for (const r of list) doInsert(table, r as Record<string, unknown>)
      save()
    },
    async update(table, id, patch) {
      db = load()
      const r = rows(table).find((x) => x.id === id)
      if (!r) throw new Error('Élément introuvable')
      guardWrite(table, r, 'update')
      Object.assign(r, patch, { updated_at: now(), updated_by: current?.id ?? null })
      save()
      emit({ table, type: 'UPDATE', row: r })
      // trigger : le prénom / la couleur du profil se propagent aux participations
      if (table === 'profiles') {
        for (const m of rows('trip_members').filter((m) => m.user_id === id)) {
          Object.assign(m, { display_name: r.display_name, color: r.color, updated_at: now() })
          emit({ table: 'trip_members', type: 'UPDATE', row: m })
        }
      }
      if (!('sort_order' in patch && Object.keys(patch).length <= 2)) log(table, 'update', r)
      save()
    },
    async remove(table, match) {
      db = load()
      const victims = rows(table).filter((r) => matches(r, match))
      victims.forEach((v) => guardWrite(table, v, 'delete'))
      const ids = new Set(victims.map((v) => v.id))
      removeWhere(table, (r) => ids.has(r.id))
      // cascades équivalentes aux clés étrangères Postgres
      const CASCADE: Record<string, [TableName, string][]> = {
        expenses: [['expense_shares', 'expense_id']],
        activities: [['activity_links', 'activity_id'], ['activity_votes', 'activity_id'], ['activity_attendees', 'activity_id']],
        bookings: [['booking_attendees', 'booking_id']],
        options: [['option_votes', 'option_id']],
      }
      for (const [child, fk] of CASCADE[table] ?? []) removeWhere(child, (r) => ids.has(r[fk] as string))
      if (['activities', 'bookings', 'expenses', 'journal_entries'].includes(table)) {
        removeWhere('comments', (r) => ids.has(r.parent_id as string))
        removeWhere('attachments', (r) => ids.has(r.parent_id as string))
      }
      const SET_NULL: Record<string, [TableName, string][]> = {
        bookings: [['activities', 'linked_booking_id'], ['expenses', 'booking_id']],
        activities: [['expenses', 'activity_id']],
        places: [['activities', 'place_id'], ['bookings', 'place_id']],
      }
      for (const [child, fk] of SET_NULL[table] ?? []) {
        for (const r of rows(child)) if (ids.has(r[fk] as string)) { r[fk] = null; emit({ table: child, type: 'UPDATE', row: r }) }
      }
      if (table === 'trips') {
        for (const t of TRIP_TABLES) removeWhere(t, (r) => ids.has(r.trip_id as string))
      }
      save()
    },
    async rpc(fn, args) {
      db = load()
      if (fn === 'public_trip') {
        const t = (rows('trips') as unknown as Trip[]).find((x) => x.share_token === args.token && x.share_enabled)
        if (!t) throw new Error('Ce lien de partage n’est plus valide')
        const pick = <T extends Row>(list: T[], keys: string[]) => list.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])))
        const of = (table: string) => rows(table).filter((r) => r.trip_id === t.id)
        return {
          trip: { id: t.id, name: t.name, destination: t.destination, lat: t.lat, lng: t.lng, start_date: t.start_date, end_date: t.end_date, currency: t.currency },
          members: pick(of('trip_members'), ['id', 'display_name', 'color']),
          places: pick(of('places'), ['id', 'name', 'address', 'lat', 'lng']),
          activities: pick(of('activities'), ['id', 'title', 'description', 'day_date', 'start_time', 'end_time', 'category', 'place_id', 'sort_order']),
          bookings: pick(of('bookings').filter((b) => b.status !== 'cancelled'), ['id', 'title', 'type', 'start_at', 'end_at', 'status', 'place_id']),
        } as never
      }
      if (!current) deny()
      const trip = (rows('trips') as unknown as Trip[]).find((t) => t.invite_token === args.token)
      if (!trip || !trip.invite_enabled) throw new Error("Ce lien d'invitation n'est plus valide")
      if (fn === 'trip_preview') {
        const members = rows('trip_members').filter((m) => m.trip_id === trip.id)
        return {
          id: trip.id, name: trip.name, destination: trip.destination, start_date: trip.start_date, end_date: trip.end_date,
          already_member: members.some((m) => m.user_id === current!.id),
          ghosts: members.filter((m) => m.is_ghost && !m.user_id).map((m) => ({ id: m.id, display_name: m.display_name })),
        } as never
      }
      // join_trip
      const existing = memberOf(trip.id)
      if (existing) return trip.id as never
      const profile = rows('profiles').find((p) => p.id === current!.id)
      const ghost = args.ghost_id ? rows('trip_members').find((m) => m.id === args.ghost_id && m.trip_id === trip.id && m.is_ghost && !m.user_id) : undefined
      if (ghost) {
        Object.assign(ghost, { user_id: current!.id, is_ghost: false, role: 'editor', updated_at: now() })
        emit({ table: 'trip_members', type: 'UPDATE', row: ghost })
      } else {
        doInsert('trip_members', {
          trip_id: trip.id, user_id: current!.id, role: 'editor', is_ghost: false,
          display_name: profile?.display_name ?? 'Invité', color: profile?.color ?? colorFor(current!.id),
        }, true)
      }
      save()
      return trip.id as never
    },
    async upload(_bucket, path, file) {
      if (file.size > 1_500_000) throw new Error('En mode démo, les fichiers sont limités à 1,5 Mo')
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = () => rej(fr.error)
        fr.readAsDataURL(file)
      })
      const files = JSON.parse(localStorage.getItem(FILES_KEY) || '{}')
      files[path] = dataUrl
      try {
        localStorage.setItem(FILES_KEY, JSON.stringify(files))
      } catch {
        throw new Error('Stockage du navigateur plein (mode démo)')
      }
    },
    async fileUrl(_bucket, path) {
      const files = JSON.parse(localStorage.getItem(FILES_KEY) || '{}')
      return files[path] ?? ''
    },
    async removeFiles(_bucket, paths) {
      const files = JSON.parse(localStorage.getItem(FILES_KEY) || '{}')
      paths.forEach((p) => delete files[p])
      localStorage.setItem(FILES_KEY, JSON.stringify(files))
    },
    subscribe(cb) {
      changeListeners.add(cb)
      return () => changeListeners.delete(cb)
    },
    presence(tripId, me, cb) {
      const seen = new Map<string, { u: PresenceUser; at: number }>()
      seen.set(me.user_id, { u: me, at: Date.now() })
      const flush = () => {
        const limit = Date.now() - 15_000
        for (const [k, v] of seen) if (v.at < limit && k !== me.user_id) seen.delete(k)
        cb([...seen.values()].map((v) => v.u))
      }
      const ping = () => bc?.postMessage({ kind: 'presence', tripId, u: me })
      const onMsg = (msg: MessageEvent) => {
        const d = msg.data as { kind: string; tripId: string; u: PresenceUser }
        if (d.kind === 'presence' && d.tripId === tripId && d.u.user_id !== me.user_id) {
          const isNew = !seen.has(d.u.user_id)
          seen.set(d.u.user_id, { u: d.u, at: Date.now() })
          if (isNew) ping()
          flush()
        }
      }
      bc?.addEventListener('message', onMsg)
      ping()
      flush()
      const timer = setInterval(() => {
        ping()
        flush()
      }, 5000)
      return () => {
        clearInterval(timer)
        bc?.removeEventListener('message', onMsg)
      }
    },
  }
}
