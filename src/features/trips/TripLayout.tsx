import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Home, CalendarDays, Map as MapIcon, Ticket, Wallet, Plus, MoreHorizontal, BellRing, Users,
  History, Settings, ListChecks, BookOpen, FileLock2, Sun, Scale, Images, WifiOff, X, Printer, CalendarPlus, Receipt, MapPin, Eye,
} from 'lucide-react'
import { useTrips, useTripTable } from '@/lib/data'
import { useAuth } from '@/features/auth/AuthProvider'
import { backend, type PresenceUser } from '@/lib/backend'
import { useOnline } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { fmtDateRange } from '@/lib/format'
import { countdownLabel } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/Logo'
import { TripProvider, useTrip } from './TripContext'
import { QuickAddProvider, useQuickAdd } from './QuickAdd'
import { exportIcs } from './exportIcs'

const TABS = [
  { to: '', label: 'Accueil', icon: Home, end: true },
  { to: 'planning', label: 'Planning', icon: CalendarDays },
  { to: 'map', label: 'Carte', icon: MapIcon },
  { to: 'bookings', label: 'Réservations', icon: Ticket },
  { to: 'budget', label: 'Budget', icon: Wallet },
] as const

const MORE = [
  { to: 'today', label: 'Jour J', icon: Sun },
  { to: 'todo', label: 'À réserver', icon: BellRing },
  { to: 'compare', label: 'Comparer', icon: Scale },
  { to: 'members', label: 'Participants', icon: Users },
  { to: 'checklist', label: 'Préparatifs', icon: ListChecks },
  { to: 'journal', label: 'Journal', icon: BookOpen },
  { to: 'album', label: 'Album', icon: Images },
  { to: 'documents', label: 'Documents', icon: FileLock2 },
  { to: 'history', label: 'Historique', icon: History },
  { to: 'settings', label: 'Paramètres du voyage', icon: Settings },
] as const

export function TripLayout() {
  const { tripId } = useParams()
  const { user } = useAuth()
  const trips = useTrips()
  const members = useTripTable(tripId, 'trip_members')
  const trip = trips.data?.find((t) => t.id === tripId)

  if (trips.isLoading || (members.isLoading && !members.data)) {
    return (
      <div className="container max-w-3xl space-y-4 py-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (!trip || !user) {
    return (
      <div className="container max-w-md py-16">
        <EmptyState
          icon={MapPin}
          title="Voyage introuvable"
          description="Il a peut-être été supprimé, ou tu n'en fais plus partie."
          action={<Button asChild><Link to="/">Mes voyages</Link></Button>}
        />
      </div>
    )
  }
  return (
    <TripProvider trip={trip} members={members.data ?? []} userId={user.id}>
      <QuickAddProvider>
        <TripShell />
      </QuickAddProvider>
    </TripProvider>
  )
}

function usePresence() {
  const { trip, me } = useTrip()
  const { user } = useAuth()
  const [users, setUsers] = useState<PresenceUser[]>([])
  useEffect(() => {
    if (!user || !me) return
    return backend.presence(trip.id, { user_id: user.id, name: me.display_name, color: me.color }, setUsers)
  }, [trip.id, user, me])
  return users
}

function TripShell() {
  const { t } = useTranslation()
  const { trip, canEdit, role } = useTrip()
  const online = useOnline()
  const presence = usePresence()
  const location = useLocation()
  const base = `/t/${trip.id}`
  const fullscreen = /\/ticket$/.test(location.pathname)
  const isMap = /\/map$/.test(location.pathname)
  const isPlanning = /\/planning$/.test(location.pathname)

  useEffect(() => {
    document.title = `${trip.name} · Vadrouille`
    return () => {
      document.title = 'Vadrouille'
    }
  }, [trip.name])

  if (fullscreen) return <Outlet />

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Barre latérale desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card/60 p-4 lg:flex no-print">
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <Logo className="h-7 w-7" /> Mes voyages
        </Link>
        <div className="mb-4">
          <h2 className="truncate text-lg font-semibold">{trip.name}</h2>
          <p className="text-xs text-muted-foreground">{fmtDateRange(trip.start_date, trip.end_date)} · {countdownLabel(trip.start_date, trip.end_date)}</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Navigation du voyage">
          {[...TABS, ...MORE].map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to ? `${base}/${tab.to}` : base}
              end={'end' in tab}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  isActive && 'bg-primary/10 text-primary')
              }
            >
              <tab.icon className="h-4 w-4" /> {t(tab.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 pt-4">
          <PresenceBar users={presence} />
          <MoreMenu inSidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* En-tête mobile */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/90 px-2 py-2 pt-safe backdrop-blur lg:hidden no-print">
          <Button asChild variant="ghost" size="icon" aria-label="Mes voyages">
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold leading-tight">{trip.name}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{fmtDateRange(trip.start_date, trip.end_date)} · {countdownLabel(trip.start_date, trip.end_date)}</p>
          </div>
          <PresenceBar users={presence} compact />
          <MoreMenu />
        </header>

        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warning/20 px-3 py-1.5 text-xs font-semibold no-print" role="status">
            <WifiOff className="h-3.5 w-3.5" /> {t('Hors ligne — lecture seule')}
          </div>
        )}
        {role === 'viewer' && (
          <div className="flex items-center justify-center gap-2 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground no-print">
            <Eye className="h-3.5 w-3.5" /> Tu consultes ce voyage en lecture seule
          </div>
        )}

        {isMap ? (
          <main className="flex-1">
            <Outlet />
          </main>
        ) : (
          <main className="flex-1 px-4 pb-28 pt-4 lg:px-10 lg:pb-12 lg:pt-8 2xl:px-14">
            <div className={cn('mx-auto w-full', isPlanning ? 'max-w-none' : 'max-w-7xl')}>
              <Outlet />
            </div>
          </main>
        )}

        {canEdit && online && !isMap && <Fab />}

        {/* Onglets mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-safe backdrop-blur lg:hidden no-print" aria-label="Navigation du voyage">
          <div className="grid grid-cols-5">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to ? `${base}/${tab.to}` : base}
                end={'end' in tab}
                className={({ isActive }) =>
                  cn('flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold text-muted-foreground', isActive && 'text-primary')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('rounded-full px-4 py-1 transition-colors', isActive && 'bg-primary/12 bg-primary/10')}>
                      <tab.icon className="h-5 w-5" />
                    </span>
                    {t(tab.label)}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

function PresenceBar({ users, compact }: { users: PresenceUser[]; compact?: boolean }) {
  if (users.length <= 1) return null
  return (
    <div className={cn('flex items-center gap-2', !compact && 'rounded-xl bg-muted px-3 py-2')} aria-label="Participants en ligne">
      <div className="flex -space-x-2">
        {users.slice(0, 4).map((u) => (
          <span key={u.user_id} className="relative">
            <Avatar name={u.name} color={u.color} size="xs" title={`${u.name} est en ligne`} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
          </span>
        ))}
      </div>
      {!compact && <span className="text-xs text-muted-foreground">{users.length} en ligne</span>}
    </div>
  )
}

function MoreMenu({ inSidebar }: { inSidebar?: boolean }) {
  const { t } = useTranslation()
  const { trip } = useTrip()
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const base = `/t/${trip.id}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {inSidebar ? (
          <Button variant="outline" className="w-full justify-start"><MoreHorizontal /> Exporter</Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label={t('Plus')}><MoreHorizontal className="h-5 w-5" /></Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!inSidebar && (
          <>
            {MORE.map((m) => (
              <DropdownMenuItem key={m.to} asChild>
                <Link to={`${base}/${m.to}`}><m.icon /> {t(m.label)}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Exporter</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to={`${base}/print`}><Printer /> Programme (PDF)</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportIcs(trip, activities.data ?? [], bookings.data ?? [])}>
          <CalendarPlus /> Calendrier (.ics)
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`${base}/budget?export=csv`}><Receipt /> Dépenses (CSV)</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Fab() {
  const [open, setOpen] = useState(false)
  const quick = useQuickAdd()
  const items = [
    { kind: 'activity' as const, label: 'Activité', icon: CalendarDays, color: 'bg-primary text-primary-foreground' },
    { kind: 'booking' as const, label: 'Réservation', icon: Ticket, color: 'bg-coral text-coral-foreground' },
    { kind: 'quick-expense' as const, label: 'Dépense', icon: Wallet, color: 'bg-success text-success-foreground' },
  ]
  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8 no-print">
      {open && <button aria-label="Fermer" className="fixed inset-0 -z-10 cursor-default bg-background/60 backdrop-blur-[1px]" onClick={() => setOpen(false)} />}
      {open &&
        items.map((it, i) => (
          <button
            key={it.kind}
            onClick={() => {
              setOpen(false)
              quick({ kind: it.kind })
            }}
            className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${(items.length - i) * 30}ms` }}
          >
            <span className="rounded-full bg-card px-3 py-1 text-sm font-semibold shadow">{it.label}</span>
            <span className={cn('flex h-12 w-12 items-center justify-center rounded-full shadow-lg', it.color)}>
              <it.icon className="h-5 w-5" />
            </span>
          </button>
        ))}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fermer le menu d’ajout' : 'Ajout rapide'}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-coral-foreground shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
    </div>
  )
}
