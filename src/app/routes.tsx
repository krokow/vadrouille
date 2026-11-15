import { Suspense } from 'react'
import { Route, Routes, Link } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuth } from '@/features/auth/AuthProvider'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Landing } from './Landing'
import { Button } from '@/components/ui/button'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Landing />
  return (
    <RequireAuth>
      <div className="p-6">Mes voyages (bientôt)</div>
    </RequireAuth>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center paper">
      <p className="text-6xl">🧭</p>
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-muted-foreground">On s'est un peu égarés en route…</p>
      <Button asChild><Link to="/">Retour à l'accueil</Link></Button>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
