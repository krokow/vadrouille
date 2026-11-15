import { createContext, useContext, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { backend, type AuthUser } from '@/lib/backend'
import type { Profile } from '@/lib/types'
import { colorFor } from '@/lib/ids'

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void backend.getUser().then((u) => {
      if (!alive) return
      setUser(u)
      setLoading(false)
    })
    const off = backend.onAuthChange((u) => {
      setUser((prev) => {
        if (prev?.id !== u?.id) qc.clear() // changement de compte : on vide le cache
        return u
      })
      setLoading(false)
    })
    return () => {
      alive = false
      off()
    }
  }, [qc])

  const profileQ = useQuery({
    queryKey: ['me', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [p] = await backend.select('profiles', { id: user!.id })
      if (p) return p
      // le trigger SQL crée normalement le profil ; filet de sécurité
      const fallback: Partial<Profile> = {
        id: user!.id,
        display_name: (user!.email ?? 'Voyageur').split('@')[0],
        color: colorFor(user!.id),
        preferred_currency: 'EUR',
        avatar_url: null,
      }
      await backend.insert('profiles', fallback)
      return fallback as Profile
    },
  })

  return (
    <AuthContext.Provider value={{ user, profile: profileQ.data ?? null, loading }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

const NEXT_KEY = 'vadrouille-next'
export const rememberNext = (path: string) => sessionStorage.setItem(NEXT_KEY, path)
export const popNext = (): string | null => {
  const v = sessionStorage.getItem(NEXT_KEY)
  sessionStorage.removeItem(NEXT_KEY)
  return v
}
