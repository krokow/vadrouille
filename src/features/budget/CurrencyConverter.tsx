import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2, WifiOff } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { CURRENCY_CODES, guessCurrency } from '@/lib/currencies'
import { cachedRate, fetchRate } from '@/lib/fx'
import { fmtMoney } from '@/lib/format'
import { Input, NativeSelect } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const QUICK = [10, 20, 50, 100, 500, 1000]

/** Convertisseur express : devise locale ⇄ devise du voyage, avec taux gardé hors ligne */
export function CurrencyConverter({ className }: { className?: string }) {
  const { trip } = useTrip()
  const expenses = useTripTable(trip.id, 'expenses')
  const foreignDefault = useMemo(() => {
    const used = (expenses.data ?? []).filter((e) => e.currency !== trip.currency).sort((a, b) => b.date.localeCompare(a.date))[0]?.currency
    return used ?? guessCurrency(trip.destination) ?? (trip.currency === 'EUR' ? 'USD' : 'EUR')
  }, [expenses.data, trip.currency, trip.destination])
  const [from, setFrom] = useState(foreignDefault)
  const [to, setTo] = useState(trip.currency)
  const [amount, setAmount] = useState('100')
  const [rate, setRate] = useState<number | null>(() => cachedRate(foreignDefault, trip.currency)?.rate ?? null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => setFrom(foreignDefault), [foreignDefault])
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchRate(from, to)
      .then((r) => { if (alive) { setRate(r); setOffline(false) } })
      .catch(() => {
        const c = cachedRate(from, to)
        if (alive) { setRate(c?.rate ?? null); setOffline(true) }
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [from, to])

  const n = Number(amount.replace(',', '.').replace(/\s/g, ''))
  const result = rate != null && !Number.isNaN(n) ? n * rate : null

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="space-y-1">
          <NativeSelect value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Devise de départ">{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="text-lg font-bold" aria-label="Montant à convertir" />
        </div>
        <Button variant="outline" size="icon" className="mb-0.5" aria-label="Inverser" onClick={() => { setFrom(to); setTo(from) }}><ArrowLeftRight /></Button>
        <div className="space-y-1">
          <NativeSelect value={to} onChange={(e) => setTo(e.target.value)} aria-label="Devise d’arrivée">{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
          <div className="flex h-11 items-center rounded-xl bg-primary/10 px-3 text-lg font-extrabold text-primary tabular sm:h-10" aria-live="polite">
            {loading && rate == null ? <Loader2 className="h-4 w-4 animate-spin" /> : result != null ? fmtMoney(result, to) : '—'}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setAmount(String(q))} className="rounded-full border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-accent">
            {q} {from} = <span className="text-primary">{rate != null ? fmtMoney(q * rate, to, { compact: q * rate >= 100 }) : '…'}</span>
          </button>
        ))}
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {offline && <WifiOff className="h-3 w-3" />}
        {rate != null ? `1 ${from} = ${rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${to}` : 'Taux indisponible'}
        {offline ? ' · dernier taux connu (hors ligne)' : ' · taux BCE (frankfurter.app)'}
      </p>
    </div>
  )
}
