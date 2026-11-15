import { Link } from 'react-router-dom'
import { CalendarDays, Map, Ticket, Wallet, BellRing, Users, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/Logo'
import { isDemo } from '@/lib/backend'

const FEATURES = [
  { icon: CalendarDays, title: 'Planning jour par jour', text: 'Glisse-dépose les activités, vote pour les idées avant de les caler.' },
  { icon: BellRing, title: 'Rien à oublier', text: 'Ce qui reste à réserver, trié par urgence, avec les dates limites.' },
  { icon: Map, title: 'Carte partagée', text: 'Tous les lieux du voyage, filtrés par jour, avec l’itinéraire.' },
  { icon: Ticket, title: 'Billets sous la main', text: 'Numéros de confirmation et PDF en plein écran, même au guichet.' },
  { icon: Wallet, title: 'Budget et comptes', text: 'Multi-devises, répartition des dépenses et remboursements simplifiés.' },
  { icon: Users, title: 'À plusieurs, en direct', text: 'Chaque modification apparaît instantanément chez les autres.' },
]

export function Landing() {
  return (
    <div className="min-h-dvh paper">
      <header className="container flex items-center justify-between py-4">
        <Wordmark />
        <Button asChild variant="ghost"><Link to="/login">Se connecter</Link></Button>
      </header>
      <main className="container max-w-7xl pb-16">
        <section className="py-10 text-center sm:py-16">
          <p className="mb-3 inline-block rounded-full bg-coral/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-coral">
            Carnet de voyage partagé
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
            Préparez le voyage <span className="text-primary">ensemble</span>, sans tableur.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Planning, carte, réservations, budget et points d'attention : toute la bande voit la même chose, en temps réel.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="coral"><Link to="/login">Commencer gratuitement</Link></Button>
            {isDemo && <p className="text-xs text-muted-foreground">Mode démo : données stockées dans ce navigateur</p>}
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border bg-card p-5 shadow-sm">
              <f.icon className="mb-3 h-6 w-6 text-primary" />
              <h2 className="font-display text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="h-4 w-4" /> Installable sur l'écran d'accueil, consultable hors ligne.
        </p>
      </main>
    </div>
  )
}
