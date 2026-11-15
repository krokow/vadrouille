import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, AuthUser, ChangeEvent, PresenceUser } from './types'
import type { TableName } from '../types'

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: {
      // flux implicite : le lien magique fonctionne même s'il est ouvert sur un autre appareil
      flowType: 'implicit',
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null =>
    u ? { id: u.id, email: u.email ?? null } : null

  const check = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message)
    return res.data
  }

  return {
    mode: 'supabase',
    async getUser() {
      const { data } = await sb.auth.getSession()
      return toUser(data.session?.user)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(toUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async sendMagicLink(email, next) {
      const redirect = new URL(import.meta.env.BASE_URL, window.location.origin)
      if (next && next !== '/') redirect.searchParams.set('next', next)
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
      })
      if (error) throw new Error(error.message)
    },
    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async select(table, match, opts) {
      let q = sb.from(table).select('*')
      for (const [k, v] of Object.entries(match ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v)
      if (opts?.order) q = q.order(opts.order, { ascending: opts.ascending ?? true })
      if (opts?.limit) q = q.limit(opts.limit)
      return check(await q) as never
    },
    async insert(table, rows) {
      check(await sb.from(table).insert(rows as never))
    },
    async update(table, id, patch) {
      check(await sb.from(table).update(patch as never).eq('id', id))
    },
    async remove(table, match) {
      let q = sb.from(table).delete()
      for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v)
      check(await q)
    },
    async rpc(fn, args) {
      return check(await sb.rpc(fn, args)) as never
    },
    async upload(bucket, path, file) {
      check(await sb.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' }))
    },
    async fileUrl(bucket, path) {
      if (bucket === 'avatars') return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl
      const data = check(await sb.storage.from(bucket).createSignedUrl(path, 60 * 60))
      return data?.signedUrl ?? ""
    },
    async removeFiles(bucket, paths) {
      if (paths.length) check(await sb.storage.from(bucket).remove(paths))
    },
    subscribe(cb) {
      // Un seul canal : Realtime applique les politiques RLS, on ne reçoit que les voyages dont on est membre.
      const channel = sb
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const e: ChangeEvent = {
            table: payload.table as TableName,
            type: payload.eventType as ChangeEvent['type'],
            row: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          }
          cb(e)
        })
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
    presence(tripId, me, cb) {
      const channel = sb.channel(`presence:${tripId}`, { config: { presence: { key: me.user_id } } })
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PresenceUser>()
          cb(Object.values(state).map((arr) => arr[0]).filter(Boolean))
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel.track(me)
        })
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
