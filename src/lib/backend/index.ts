import { createSupabaseBackend } from './supabase'
import { createLocalBackend } from './local'
import type { Backend } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const forceDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

/** Sans variables Supabase (ou avec ?demo), l'app tourne en « mode démo » 100 % local. */
export const backend: Backend = url && key && !forceDemo ? createSupabaseBackend(url, key) : createLocalBackend()
export const isDemo = backend.mode === 'local'
export type * from './types'
