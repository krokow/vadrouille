import type { TableMap, TableName } from '../types'

export interface AuthUser {
  id: string
  email: string | null
}

export type Match = Record<string, string | number | boolean | null>

export interface ChangeEvent {
  table: TableName
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  /** nouvelle ligne (INSERT/UPDATE) */
  row?: Record<string, unknown>
  /** ancienne ligne, au minimum { id } (DELETE) */
  old?: Record<string, unknown>
}

export interface PresenceUser {
  user_id: string
  name: string
  color: string
}

export interface Backend {
  mode: 'supabase' | 'local'
  // --- Auth
  getUser(): Promise<AuthUser | null>
  onAuthChange(cb: (user: AuthUser | null) => void): () => void
  sendMagicLink(email: string, next: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
  // --- Données (requêtes plates, les jointures sont faites côté client)
  select<T extends TableName>(
    table: T,
    match?: Match,
    opts?: { order?: string; ascending?: boolean; limit?: number },
  ): Promise<TableMap[T][]>
  insert<T extends TableName>(table: T, rows: Partial<TableMap[T]> | Partial<TableMap[T]>[]): Promise<void>
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Promise<void>
  remove(table: TableName, match: Match): Promise<void>
  rpc<R = unknown>(fn: RpcName, args: Record<string, unknown>): Promise<R>
  // --- Fichiers (bucket privé `trip-files`, chemins `trip_id/…` ; bucket public `avatars`)
  upload(bucket: Bucket, path: string, file: File | Blob): Promise<void>
  fileUrl(bucket: Bucket, path: string): Promise<string>
  removeFiles(bucket: Bucket, paths: string[]): Promise<void>
  // --- Temps réel
  subscribe(cb: (e: ChangeEvent) => void): () => void
  presence(tripId: string, me: PresenceUser, cb: (users: PresenceUser[]) => void): () => void
}

export type Bucket = 'trip-files' | 'avatars'
export type RpcName = 'join_trip' | 'trip_preview'
