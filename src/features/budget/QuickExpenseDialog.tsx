import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, SlidersHorizontal, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { BUDGET_CATEGORIES } from '@/lib/constants'
import { guessCurrency } from '@/lib/currencies'
import { fetchRate } from '@/lib/fx'
import { fmtMoney, isoDay } from '@/lib/format'
import type { BudgetCategory } from '@/lib/types'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { saveExpense } from './api'
import { toMain } from './logic'

/**
 * Dépense en 3 secondes : montant → tap sur une catégorie = enregistré.
 * Payé par moi, réparti à parts égales entre tout le monde (modifiable).
 */
export default function QuickExpenseDialog({ onClose }: { onClose: () => void }) {
  const { trip, members, me, writer } = useTrip()
  const quick = useQuickAdd()
  const expenses = useTripTable(trip.id, 'expenses')
  const inputRef = useRef<HTMLInputElement>(null)
  const currencies = useMemo(() => {
    const recent = (expenses.data ?? []).map((e) => e.currency)
    const guess = guessCurrency(trip.destination)
    return [...new Set([trip.currency, ...(guess ? [guess] : []), ...recent])].slice(0, 4)
  }, [expenses.data, trip.currency, trip.destination])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(trip.currency)
  const [title, setTitle] = useState('')
  const [payer, setPayer] = useState(me?.id ?? members[0]?.id ?? '')
  const [who, setWho] = useState<'all' | 'me'>('all')
  const [rate, setRate] = useState<number | null>(1)
  const [saving, setSaving] = useState<BudgetCategory | null>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [])
  useEffect(() => {
    if (currency === trip.currency) return setRate(1)
    setRate(null)
    fetchRate(currency, trip.currency, isoDay()).then(setRate).catch(() => setRate(null))
  }, [currency, trip.currency])

  const n = Number(amount.replace(',', '.').replace(/\s/g, ''))
  const valid = n > 0 && !Number.isNaN(n)

  const save = async (category: BudgetCategory) => {
    if (!valid) {
      inputRef.current?.focus()
      return toast.error('Saisis d’abord un montant')
    }
    if (!rate) return toast.error('Taux de change indisponible : utilise le formulaire détaillé')
    setSaving(category)
    try {
      const split = (who === 'me' ? members.filter((m) => m.id === payer) : members).map((m) => ({ member_id: m.id }))
      await saveExpense(writer, trip.id, {
        title: title.trim() || BUDGET_CATEGORIES[category].label, amount: n, currency, fx_rate: rate, date: isoDay(),
        category, paid_by: payer, split_mode: 'equal', split,
      })
      toast.success(`${fmtMoney(n, currency)} · ${BUDGET_CATEGORIES[category].emoji} ajouté`)
      onClose()
    } catch {
      setSaving(null)
    }
  }

  const details = () => {
    onClose()
    quick({ kind: 'expense', defaults: { title, amount: valid ? n : undefined, currency, paid_by: payer, split_mode: 'percent' } })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-warning" /> Dépense rapide</DialogTitle>
          <DialogDescription>Montant, puis touche une catégorie : c’est enregistré.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex items-stretch gap-2">
            <Input ref={inputRef} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              aria-label="Montant" className="h-16 flex-1 text-center text-4xl font-extrabold tabular sm:h-16" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label="Devise">
            {currencies.map((c) => (
              <button key={c} role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)}
                className={cn('rounded-full border px-3 py-1 text-xs font-bold', currency === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
                {c}
              </button>
            ))}
            {currency !== trip.currency && (
              <span className="text-xs text-muted-foreground">{rate && valid ? `≈ ${fmtMoney(toMain(n, rate), trip.currency)}` : rate ? '' : 'taux…'}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(BUDGET_CATEGORIES) as [BudgetCategory, (typeof BUDGET_CATEGORIES)[BudgetCategory]][]).map(([k, c]) => (
              <button key={k} onClick={() => save(k)} disabled={!!saving}
                className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-60"
                style={{ boxShadow: `inset 0 -3px 0 ${c.color}` }}>
                {saving === k ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="text-2xl">{c.emoji}</span>}
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl bg-muted/50 p-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (facultatif) : glaces, taxi…" aria-label="Titre" />
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Payé par">
                {members.map((m) => <option key={m.id} value={m.id}>Payé par {m.id === me?.id ? 'moi' : m.display_name}</option>)}
              </NativeSelect>
              <NativeSelect value={who} onChange={(e) => setWho(e.target.value as 'all' | 'me')} aria-label="Pour qui">
                <option value="all">Pour tout le monde</option>
                <option value="me">Juste pour {payer === me?.id ? 'moi' : 'le payeur'}</option>
              </NativeSelect>
            </div>
          </div>
          <Button variant="ghost" className="w-full" onClick={details}><SlidersHorizontal /> Répartition détaillée (%, parts, montants…)</Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
