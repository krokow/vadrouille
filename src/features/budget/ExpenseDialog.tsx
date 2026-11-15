import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, RefreshCw, Receipt, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { BUDGET_CATEGORIES } from '@/lib/constants'
import { CURRENCY_CODES } from '@/lib/currencies'
import { fetchRate } from '@/lib/fx'
import { fmtMoney, isoDay } from '@/lib/format'
import { compressImage, uploadTripFile } from '@/lib/files'
import { backend } from '@/lib/backend'
import type { BudgetCategory, Expense } from '@/lib/types'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'
import { customSplitGap, evenPercents, percentGap, toMain } from './logic'
import { computeShares, saveExpense } from './api'

const num = (s: string | undefined) => (s ? Number(s.replace(',', '.').replace(/\s/g, '')) : NaN)

const schema = z
  .object({
    title: z.string().trim().min(1, 'Un titre est requis').max(200),
    amount: z.string().min(1, 'Montant requis'),
    currency: z.string().length(3),
    fx_rate: z.string(),
    date: z.string().min(1, 'Date requise'),
    category: z.string(),
    paid_by: z.string().min(1, 'Qui a payé ?'),
    booking_id: z.string().optional(),
    activity_id: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (Number.isNaN(num(v.amount)) || num(v.amount) === 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Montant invalide' })
    if (!(num(v.fx_rate) > 0)) ctx.addIssue({ code: 'custom', path: ['fx_rate'], message: 'Taux invalide' })
  })
type Values = z.infer<typeof schema>
type Mode = Expense['split_mode']

export default function ExpenseDialog({ id, defaults, onClose }: { id?: string; defaults?: Record<string, unknown>; onClose: () => void }) {
  const { trip, members, me, writer } = useTrip()
  const confirm = useConfirm()
  const expenses = useTripTable(trip.id, 'expenses')
  const shares = useTripTable(trip.id, 'expense_shares')
  const bookings = useTripTable(trip.id, 'bookings')
  const activities = useTripTable(trip.id, 'activities')
  const existing = id ? expenses.data?.find((e) => e.id === id) : undefined
  const existingShares = useMemo(() => (shares.data ?? []).filter((s) => s.expense_id === id), [shares.data, id])

  const [mode, setMode] = useState<Mode>(existing?.split_mode ?? (defaults?.split_mode as Mode) ?? 'equal')
  const [selected, setSelected] = useState<string[]>(
    existing ? existingShares.map((s) => s.member_id) : ((defaults?.members as string[]) ?? []).length ? (defaults!.members as string[]) : members.map((m) => m.id),
  )
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const s of existingShares) out[s.member_id] = String(existing?.split_mode === 'shares' || existing?.split_mode === 'percent' ? s.weight ?? 1 : s.share_amount)
    return out
  })
  const [receipt, setReceipt] = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: existing?.title ?? (defaults?.title as string) ?? '',
      amount: existing ? String(existing.amount) : defaults?.amount != null ? String(defaults.amount) : '',
      currency: existing?.currency ?? (defaults?.currency as string) ?? trip.currency,
      fx_rate: existing ? String(existing.fx_rate) : '1',
      date: existing?.date ?? (defaults?.date as string) ?? isoDay(),
      category: existing?.category ?? (defaults?.category as string) ?? 'food',
      paid_by: existing?.paid_by ?? (defaults?.paid_by as string) ?? me?.id ?? members[0]?.id ?? '',
      booking_id: existing?.booking_id ?? (defaults?.booking_id as string) ?? '',
      activity_id: existing?.activity_id ?? (defaults?.activity_id as string) ?? '',
    },
  })
  const errors = form.formState.errors
  const currency = form.watch('currency')
  const date = form.watch('date')
  const amount = num(form.watch('amount'))
  const rate = num(form.watch('fx_rate'))
  const foreign = currency !== trip.currency

  // taux figé à la date de la dépense (récupéré automatiquement, modifiable)
  useEffect(() => {
    if (!foreign) {
      form.setValue('fx_rate', '1')
      setRateError(null)
      return
    }
    if (existing && existing.currency === currency && existing.date === date) return
    let alive = true
    setRateLoading(true)
    setRateError(null)
    fetchRate(currency, trip.currency, date)
      .then((r) => alive && form.setValue('fx_rate', String(Math.round(r * 1e6) / 1e6)))
      .catch((e) => alive && setRateError(e instanceof Error ? e.message : 'Taux indisponible'))
      .finally(() => alive && setRateLoading(false))
    return () => {
      alive = false
    }
  }, [currency, date, foreign, trip.currency, existing, form])

  const selectedMembers = members.filter((m) => selected.includes(m.id))
  const defaultPercents = evenPercents(selectedMembers.length)
  const defaultValue = (id: string) => (mode === 'shares' ? '1' : mode === 'percent' ? String(defaultPercents[selectedMembers.findIndex((m) => m.id === id)] ?? 0) : '0')
  const split = selectedMembers.map((m) => ({ member_id: m.id, value: mode === 'equal' ? undefined : num(values[m.id] ?? defaultValue(m.id)) || 0 }))
  const pGap = mode === 'percent' ? percentGap(split.map((s) => s.value ?? 0)) : 0
  const preview = !Number.isNaN(amount) && split.length ? computeShares({ amount, split_mode: mode, split }) : []
  const gap = mode === 'amount' && !Number.isNaN(amount) ? customSplitGap(amount, split.map((s) => s.value ?? 0)) : 0

  const submit = async (v: Values) => {
    if (!selected.length) return toast.error('Choisis au moins une personne pour la répartition')
    if (mode === 'amount' && gap !== 0) return toast.error(`La répartition ne tombe pas juste (écart ${fmtMoney(gap, v.currency)})`)
    if (mode === 'percent' && pGap !== 0) return toast.error(`Les pourcentages doivent totaliser 100 % (écart ${pGap} %)`)
    try {
      let receipt_path = removeReceipt ? null : existing?.receipt_path ?? null
      if (receipt) {
        const file = receipt.type.startsWith('image/') ? await compressImage(receipt, 1800) : receipt
        receipt_path = await uploadTripFile(trip.id, file, 'receipts')
      }
      await saveExpense(writer, trip.id, {
        title: v.title, amount: num(v.amount), currency: v.currency, fx_rate: num(v.fx_rate), date: v.date,
        category: v.category as BudgetCategory, paid_by: v.paid_by, split_mode: mode, split,
        booking_id: v.booking_id || null, activity_id: v.activity_id || null, receipt_path,
      }, existing ? { id: existing.id, shares: existingShares } : undefined)
      if (existing?.receipt_path && receipt_path !== existing.receipt_path) void backend.removeFiles('trip-files', [existing.receipt_path]).catch(() => undefined)
      toast.success(existing ? 'Dépense mise à jour' : 'Dépense ajoutée')
      onClose()
    } catch {
      /* déjà signalé */
    }
  }

  const remove = async () => {
    if (!existing) return
    if (!(await confirm({ title: `Supprimer « ${existing.title} » ?`, confirmLabel: 'Supprimer', destructive: true }))) return
    await writer.remove('expenses', existing.id)
    if (existing.receipt_path) void backend.removeFiles('trip-files', [existing.receipt_path]).catch(() => undefined)
    toast.success('Dépense supprimée')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <form onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader><DialogTitle>{existing ? 'Modifier la dépense' : 'Nouvelle dépense'}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Titre" htmlFor="ex-title" error={errors.title?.message}>
              <Input id="ex-title" placeholder="Courses, dîner, essence…" autoFocus={!existing} aria-invalid={!!errors.title} {...form.register('title')} />
            </Field>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Montant" htmlFor="ex-amount" error={errors.amount?.message}>
                <Input id="ex-amount" inputMode="decimal" placeholder="0,00" className="text-lg font-bold" aria-invalid={!!errors.amount} {...form.register('amount')} />
              </Field>
              <Field label="Devise" htmlFor="ex-cur">
                <NativeSelect id="ex-cur" {...form.register('currency')}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
              </Field>
            </div>
            {foreign && (
              <div className="rounded-2xl bg-muted/60 p-3">
                <Field label={`Taux : 1 ${currency} = ? ${trip.currency}`} htmlFor="ex-rate" error={errors.fx_rate?.message ?? rateError ?? undefined}
                  hint={!Number.isNaN(amount) && rate > 0 ? `≈ ${fmtMoney(toMain(amount, rate), trip.currency)} · taux BCE du jour de la dépense (frankfurter.app), modifiable` : undefined}>
                  <div className="flex gap-2">
                    <Input id="ex-rate" inputMode="decimal" {...form.register('fx_rate')} />
                    <Button variant="outline" size="icon" aria-label="Récupérer le taux" disabled={rateLoading}
                      onClick={() => { setRateLoading(true); fetchRate(currency, trip.currency, date).then((r) => form.setValue('fx_rate', String(Math.round(r * 1e6) / 1e6))).catch((e) => setRateError(e.message)).finally(() => setRateLoading(false)) }}>
                      {rateLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    </Button>
                  </div>
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="ex-date" error={errors.date?.message}><Input id="ex-date" type="date" {...form.register('date')} /></Field>
              <Field label="Catégorie" htmlFor="ex-cat">
                <NativeSelect id="ex-cat" {...form.register('category')}>
                  {Object.entries(BUDGET_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.label}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Payé par" htmlFor="ex-payer" error={errors.paid_by?.message}>
              <NativeSelect id="ex-payer" {...form.register('paid_by')}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}{m.id === me?.id ? ' (moi)' : ''}</option>)}
              </NativeSelect>
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Répartition</span>
                <button type="button" className="text-xs font-semibold text-primary" onClick={() => setSelected(selected.length === members.length ? [] : members.map((m) => m.id))}>
                  {selected.length === members.length ? 'Personne' : 'Tout le monde'}
                </button>
              </div>
              <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setValues({}) }}>
                <TabsList className="w-full">
                  <TabsTrigger value="equal" className="px-2">Égal</TabsTrigger>
                  <TabsTrigger value="percent" className="px-2">%</TabsTrigger>
                  <TabsTrigger value="shares" className="px-2">Parts</TabsTrigger>
                  <TabsTrigger value="amount" className="px-2">Montants</TabsTrigger>
                </TabsList>
              </Tabs>
              <ul className="divide-y rounded-2xl border bg-card">
                {members.map((m) => {
                  const on = selected.includes(m.id)
                  const share = preview.find((p) => p.member_id === m.id)
                  return (
                    <li key={m.id} className={cn('flex items-center gap-3 px-3 py-2', !on && 'opacity-50')}>
                      <Checkbox id={`sp-${m.id}`} checked={on} onCheckedChange={(c) => setSelected(c ? [...selected, m.id] : selected.filter((x) => x !== m.id))} aria-label={`Inclure ${m.display_name}`} />
                      <Avatar name={m.display_name} color={m.color} size="xs" ghost={m.is_ghost} />
                      <label htmlFor={`sp-${m.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold">{m.display_name}</label>
                      {on && mode !== 'equal' && (
                        <span className="relative">
                          <Input className={cn('h-9 w-20 text-right', mode === 'percent' && 'pr-6')} inputMode="decimal"
                            aria-label={mode === 'shares' ? `Parts de ${m.display_name}` : mode === 'percent' ? `Pourcentage de ${m.display_name}` : `Montant de ${m.display_name}`}
                            value={values[m.id] ?? (mode === 'amount' ? '' : defaultValue(m.id))} placeholder={mode === 'shares' ? '1' : '0'}
                            onChange={(e) => setValues({ ...values, [m.id]: e.target.value })} />
                          {mode === 'percent' && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
                        </span>
                      )}
                      <span className="w-20 text-right text-sm tabular text-muted-foreground">{on && share ? fmtMoney(share.share_amount, currency) : '—'}</span>
                    </li>
                  )
                })}
              </ul>
              {mode === 'amount' && gap !== 0 && <p className="text-xs font-semibold text-destructive" role="alert">{gap > 0 ? `Il reste ${fmtMoney(gap, currency)} à répartir` : `${fmtMoney(-gap, currency)} de trop`}</p>}
              {mode === 'shares' && <p className="text-xs text-muted-foreground">Ex. 2 parts pour un adulte, 1 pour un enfant.</p>}
              {mode === 'percent' && (pGap !== 0
                ? <p className="text-xs font-semibold text-destructive" role="alert">{pGap > 0 ? `Il reste ${pGap} % à répartir` : `${-pGap} % de trop`}</p>
                : <p className="text-xs text-muted-foreground">Total : 100 % ✓ — ex. 60 % / 40 % pour un couple qui ne consomme pas pareil.</p>)}
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold">Reçu</span>
              {(receipt || (existing?.receipt_path && !removeReceipt)) ? (
                <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                  <Receipt className="h-4 w-4 text-primary" />
                  <span className="flex-1 truncate">{receipt?.name ?? 'Reçu enregistré'}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Retirer le reçu" onClick={() => { setReceipt(null); setRemoveReceipt(true) }}><X /></Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer"><Receipt /> Photo du reçu<input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} /></label>
                </Button>
              )}
            </div>
            {(!!bookings.data?.length || !!activities.data?.length) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {!!bookings.data?.length && (
                  <Field label="Réservation liée" htmlFor="ex-bk">
                    <NativeSelect id="ex-bk" {...form.register('booking_id')}><option value="">— Aucune —</option>{bookings.data.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</NativeSelect>
                  </Field>
                )}
                {!!activities.data?.length && (
                  <Field label="Activité liée" htmlFor="ex-act">
                    <NativeSelect id="ex-act" {...form.register('activity_id')}><option value="">— Aucune —</option>{activities.data.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</NativeSelect>
                  </Field>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {existing && <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={remove}><Trash2 /> Supprimer</Button>}
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : !existing && <Plus />} {existing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
