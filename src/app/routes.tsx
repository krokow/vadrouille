import { lazy, Suspense } from 'react'
import { Route, Routes, Link } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { useAuth } from '@/features/auth/AuthProvider'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { ListSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Landing } from './Landing'
import { TripsPage } from '@/features/trips/TripsPage'
import { TripLayout } from '@/features/trips/TripLayout'

const ProfilePage = lazy(() => import('@/features/auth/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const JoinPage = lazy(() => import('@/features/members/JoinPage').then((m) => ({ default: m.JoinPage })))
const DashboardPage = lazy(() => import('@/features/trips/DashboardPage'))
const MembersPage = lazy(() => import('@/features/members/MembersPage').then((m) => ({ default: m.MembersPage })))
const SettingsPage = lazy(() => import('@/features/trips/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const PlanningPage = lazy(() => import('@/features/activities/PlanningPage'))
const TodoPage = lazy(() => import('@/features/activities/TodoPage'))
const ActivityPage = lazy(() => import('@/features/activities/ActivityPage'))
const MapPage = lazy(() => import('@/features/map/MapPage'))
const BookingsPage = lazy(() => import('@/features/bookings/BookingsPage'))
const BookingPage = lazy(() => import('@/features/bookings/BookingPage'))
const TicketPage = lazy(() => import('@/features/bookings/TicketPage'))
const BudgetPage = lazy(() => import('@/features/budget/BudgetPage'))
const HistoryPage = lazy(() => import('@/features/trips/HistoryPage'))
const ChecklistPage = lazy(() => import('@/features/trips/ChecklistPage'))
const JournalPage = lazy(() => import('@/features/trips/JournalPage'))
const TodayPage = lazy(() => import('@/features/trips/TodayPage'))
const DocumentsPage = lazy(() => import('@/features/trips/DocumentsPage'))
const PrintPage = lazy(() => import('@/features/trips/PrintPage'))

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  return user ? <TripsPage /> : <Landing />
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

const page = (el: React.ReactNode) => <Suspense fallback={<ListSkeleton />}>{el}</Suspense>

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/join/:token" element={<RequireAuth><JoinPage /></RequireAuth>} />
        <Route path="/t/:tripId" element={<RequireAuth><TripLayout /></RequireAuth>}>
          <Route index element={page(<DashboardPage />)} />
          <Route path="planning" element={page(<PlanningPage />)} />
          <Route path="todo" element={page(<TodoPage />)} />
          <Route path="activities/:activityId" element={page(<ActivityPage />)} />
          <Route path="map" element={page(<MapPage />)} />
          <Route path="bookings" element={page(<BookingsPage />)} />
          <Route path="bookings/:bookingId" element={page(<BookingPage />)} />
          <Route path="bookings/:bookingId/ticket" element={page(<TicketPage />)} />
          <Route path="budget" element={page(<BudgetPage />)} />
          <Route path="members" element={page(<MembersPage />)} />
          <Route path="settings" element={page(<SettingsPage />)} />
          <Route path="history" element={page(<HistoryPage />)} />
          <Route path="checklist" element={page(<ChecklistPage />)} />
          <Route path="journal" element={page(<JournalPage />)} />
          <Route path="today" element={page(<TodayPage />)} />
          <Route path="documents" element={page(<DocumentsPage />)} />
          <Route path="print" element={page(<PrintPage />)} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
