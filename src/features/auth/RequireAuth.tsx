import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { FullPageSpinner } from '@/components/FullPageSpinner'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <>{children}</>
}
