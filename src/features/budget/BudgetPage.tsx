import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Download, Plus, Receipt, Scale, Trash2, Wallet, PieChart as PieIcon, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { BUDGET_CATEGORIES } from '@/lib/constants'
import { fmtDay, fmtDayLong, fmtMoney, isoDay } from '@/lib/format'
import { useFileUrl } from '@/lib/files'
import { downloadFile } from '@/lib/utils'
import type { BudgetCategory, Expense } from '@/lib/types'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { Gauge } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { useConfirm } from '@/components/ui/confirm'
import { UpdatedBy } from '@/components/UpdatedBy'
import { computeBalances, simplifyDebts, spentPerMember, totalsBy, type Transfer } from './logic'
import { expensesToCsv } from './csv'

export default function BudgetPage() {
  const { trip, members, memberById, canEdit, writer, me } = useTrip()
  const quick = useQuickAdd()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const expenses = useTripTable(trip.id, 'expenses')
  const shares = useTripTable(trip.id, 'expense_shares')
  const settlements = useTripTable(trip.id, 'settlements')
  const budgets = useTripTable(trip.id, 'budgets')
  const [catFilter, setCatFilter] = useState<BudgetCategory | 'all'>('all')
  const cur = trip.currency

  const list = useMemo(() => expenses.data ?? [], [expenses.data])
  const total = list.reduce((s, e) => s + Number(e.amount_main), 0)
  const balances = useMemo(
    () => computeBalances(members.map((m) => m.id), list, shares.data ?? [], settlements.data ?? []),
    [members, list, shares.data, settlements.data],
  )
  const transfers = useMemo(() => simplifyDebts(balances), [balances])
  const byCategory = useMemo(() => totalsBy(list, (e) => e.category, (e) => Number(e.amount_main)), [list])
  const byDay = useMemo(() => totalsBy(list, (e) => e.date, (e) => Number(e.amount_main)), [list])
  const perMember = useMemo(() => spentPerMember(list, shares.data ?? []), [list, shares.data])
  const plannedByCat = useMemo(() => Object.fromEntries((budgets.data ?? []).map((b) => [b.category, Number(b.planned_amount)])), [budgets.data])
  const plannedTotal = trip.total_budget ?? Object.values(plannedByCat).reduce((a, b) => a + b, 0)

  const exportCsv = () => {
    downloadFile(`depenses-${trip.name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}.csv`, expensesToCsv(list, shares.data ?? [], members, cur), 'text/csv;charset=utf-8')
  }

  // liens profonds : ?export=csv (menu) et ?expense=<id>
  useEffect(() => {
    if (params.get('export') === 'csv' && expenses.data && shares.data) {
      exportCsv()
      setParams({}, { replace: true })
    }
    const ex = params.get('expense')
    if (ex && expenses.data?.some((e) => e.id === ex)) {
      quick({ kind: 'expense', id: ex })
      setParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, expenses.data, shares.data])

  const settle = async (t: Transfer) => {
    const ok = await confirm({
      title: 'Marquer comme remboursé ?',
      description: `${memberById[t.from]?.display_name} a remboursé ${fmtMoney(t.amount, cur)} à ${memberById[t.to]?.display_name}.`,
      confirmLabel: 'Oui, c’est réglé',
    })
    if (!ok) return
    await writer.insert('settlements', { trip_id: trip.id, from_member: t.from, to_member: t.to, amount: t.amount, settled_at: new Date().toISOString() })
    toast.success('Remboursement enregistré 🤝')
  }

  const grouped = useMemo(() => {
    const filtered = list.filter((e) => catFilter === 'all' || e.category === catFilter).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    const out: { day: string; items: Expense[]; sum: number }[] = []
    for (const e of filtered) {
      const last = out.at(-1)
      if (last?.day === e.date) { last.items.push(e); last.sum += Number(e.amount_main) }
      else out.push({ day: e.date, items: [e], sum: Number(e.amount_main) })
    }
    return out
  }, [list, catFilter])

  if (expenses.isLoading) return <ListSkeleton />

  const myBalance = me ? balances[me.id] ?? 0 : 0

  return (
    <div className="space-y-4">
      <PageTitle title="Budget" subtitle={`${list.length} dépense${list.length > 1 ? 's' : ''} · devise ${cur}`}
        action={<div className="flex gap-2">
          {list.length > 0 && <Button variant="outline" size="icon" onClick={exportCsv} aria-label="Exporter en CSV" title="Exporter en CSV"><Download /></Button>}
          {canEdit && <Button onClick={() => quick({ kind: 'expense' })} className="hidden sm:inline-flex"><Plus /> Dépense</Button>}
        </div>} />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total dépensé</p>
          <p className="text-2xl font-bold tabular">{fmtMoney(total, cur)}</p>
          {plannedTotal > 0 && <><Gauge value={total} max={plannedTotal} className="mt-2" label="Budget consommé" /><p className="mt-1 text-xs text-muted-foreground">sur {fmtMoney(plannedTotal, cur, { compact: true })} prévus</p></>}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Mon solde</p>
          <p className={`text-2xl font-bold tabular ${myBalance > 0.004 ? 'text-success' : myBalance < -0.004 ? 'text-coral' : ''}`}>{fmtMoney(myBalance, cur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{myBalance > 0.004 ? 'On te doit de l’argent' : myBalance < -0.004 ? 'Tu dois de l’argent' : 'Tu es à l’équilibre'}</p>
        </Card>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="w-full">
          <TabsTrigger value="expenses" className="px-2"><Receipt className="hidden sm:block" /> Dépenses</TabsTrigger>
          <TabsTrigger value="balances" className="px-2"><Scale className="hidden sm:block" /> Soldes</TabsTrigger>
          <TabsTrigger value="stats" className="px-2"><PieIcon className="hidden sm:block" /> Stats</TabsTrigger>
          <TabsTrigger value="plan" className="px-2"><Target className="hidden sm:block" /> Prévu</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          {list.length > 0 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
              <Chip active={catFilter === 'all'} onClick={() => setCatFilter('all')}>Tout</Chip>
              {(Object.keys(BUDGET_CATEGORIES) as BudgetCategory[]).filter((c) => byCategory[c]).map((c) => (
                <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>{BUDGET_CATEGORIES[c].emoji} {BUDGET_CATEGORIES[c].label}</Chip>
              ))}
            </div>
          )}
          {!list.length ? (
            <EmptyState icon={Wallet} title="Aucune dépense" description="Ajoute les dépenses au fil du voyage : on calcule qui doit combien à qui."
              action={canEdit && <Button onClick={() => quick({ kind: 'expense' })}><Plus /> Ajouter une dépense</Button>} />
          ) : (
            grouped.map((g) => (
              <section key={g.day}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-bold text-muted-foreground first-letter:uppercase">{fmtDayLong(g.day)}</h2>
                  <span className="text-xs font-semibold tabular text-muted-foreground">{fmtMoney(g.sum, cur)}</span>
                </div>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                  {g.items.map((e) => <ExpenseRow key={e.id} e={e} onOpen={() => quick({ kind: 'expense', id: e.id })} />)}
                </ul>
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Soldes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {members.map((m) => {
                const v = balances[m.id] ?? 0
                const max = Math.max(1, ...Object.values(balances).map(Math.abs))
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.display_name} color={m.color} size="sm" ghost={m.is_ghost} />
                    <span className="w-24 truncate text-sm font-semibold">{m.display_name}</span>
                    <div className="relative h-6 flex-1">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                      <div className={`absolute inset-y-1 rounded-full ${v >= 0 ? 'left-1/2 bg-success/70' : 'right-1/2 bg-coral/70'}`} style={{ width: `${(Math.abs(v) / max) * 50}%` }} />
                    </div>
                    <span className={`w-24 text-right text-sm font-bold tabular ${v > 0.004 ? 'text-success' : v < -0.004 ? 'text-coral' : 'text-muted-foreground'}`}>{v > 0 ? '+' : ''}{fmtMoney(v, cur)}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pour s’équilibrer</CardTitle></CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tout le monde est à l’équilibre 🎉</p>
              ) : (
                <ul className="space-y-2">
                  {transfers.map((t) => (
                    <li key={`${t.from}-${t.to}`} className="flex items-center gap-2 rounded-2xl bg-muted/60 p-3">
                      <Avatar name={memberById[t.from]?.display_name ?? '?'} color={memberById[t.from]?.color ?? '#999'} size="xs" />
                      <span className="text-sm font-semibold">{memberById[t.from]?.display_name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Avatar name={memberById[t.to]?.display_name ?? '?'} color={memberById[t.to]?.color ?? '#999'} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{memberById[t.to]?.display_name}</span>
                      <span className="font-bold tabular">{fmtMoney(t.amount, cur)}</span>
                      {canEdit && <Button size="icon-sm" variant="outline" onClick={() => settle(t)} aria-label="Marquer comme remboursé" title="Marquer comme remboursé"><Check /></Button>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Nombre minimal de virements calculé automatiquement (simplification des dettes).</p>
            </CardContent>
          </Card>
          {!!settlements.data?.length && (
            <Card>
              <CardHeader><CardTitle>Remboursements effectués</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {[...settlements.data].sort((a, b) => b.settled_at.localeCompare(a.settled_at)).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{memberById[s.from_member]?.display_name} → {memberById[s.to_member]?.display_name} <span className="text-xs text-muted-foreground">· {fmtDay(s.settled_at.slice(0, 10))}</span></span>
                      <span className="font-semibold tabular">{fmtMoney(Number(s.amount), cur)}</span>
                      {canEdit && <Button variant="ghost" size="icon-sm" aria-label="Annuler ce remboursement" onClick={async () => { if (await confirm({ title: 'Annuler ce remboursement ?', destructive: true, confirmLabel: 'Annuler le remboursement' })) await writer.remove('settlements', s.id) }}><Trash2 /></Button>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {!list.length ? <EmptyState icon={PieIcon} title="Pas encore de statistiques" description="Elles apparaîtront avec les premières dépenses." /> : (
            <>
              <Card>
                <CardHeader><CardTitle>Par catégorie</CardTitle></CardHeader>
                <CardContent className="grid items-center gap-4 sm:grid-cols-2">
                  <div className="h-52">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={Object.entries(byCategory).map(([k, v]) => ({ name: BUDGET_CATEGORIES[k as BudgetCategory].label, value: v, key: k }))} dataKey="value" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="none">
                          {Object.keys(byCategory).map((k) => <Cell key={k} fill={BUDGET_CATEGORIES[k as BudgetCategory].color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtMoney(v, cur)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2">
                    {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <li key={k} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: BUDGET_CATEGORIES[k as BudgetCategory].color }} />
                        <span className="flex-1">{BUDGET_CATEGORIES[k as BudgetCategory].emoji} {BUDGET_CATEGORIES[k as BudgetCategory].label}</span>
                        <span className="font-semibold tabular">{fmtMoney(v, cur)}</span>
                        <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((v / total) * 100)} %</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Par jour</CardTitle></CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ day: fmtDay(d), value: v }))}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(v: number) => fmtMoney(v, cur)} cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }} />
                      <Bar dataKey="value" name="Dépensé" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Part de chacun</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <Avatar name={m.display_name} color={m.color} size="xs" />
                      <span className="flex-1 truncate">{m.display_name}</span>
                      <span className="font-semibold tabular">{fmtMoney(perMember[m.id] ?? 0, cur)}</span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">Coût réel du voyage pour chaque personne (sa part des dépenses).</p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="plan">
          <PlanEditor plannedByCat={plannedByCat} spentByCat={byCategory} total={total} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>{children}</button>
  )
}

function ExpenseRow({ e, onOpen }: { e: Expense; onOpen: () => void }) {
  const { trip, memberById } = useTrip()
  const cat = BUDGET_CATEGORIES[e.category] ?? BUDGET_CATEGORIES.other
  const payer = memberById[e.paid_by]
  const receipt = useFileUrl(e.receipt_path)
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${cat.color}22` }} aria-hidden>{cat.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{e.title}</span>
          <span className="block truncate text-xs text-muted-foreground">payé par <strong style={{ color: payer?.color }}>{payer?.display_name ?? '?'}</strong>{receipt.data ? ' · 🧾' : ''}</span>
          <UpdatedBy row={e} className="block" />
        </span>
        <span className="text-right">
          <span className="block font-bold tabular">{fmtMoney(Number(e.amount_main), trip.currency)}</span>
          {e.currency !== trip.currency && <span className="block text-[11px] text-muted-foreground tabular">{fmtMoney(Number(e.amount), e.currency)}</span>}
        </span>
      </button>
    </li>
  )
}

function PlanEditor({ plannedByCat, spentByCat, total }: { plannedByCat: Record<string, number>; spentByCat: Record<string, number>; total: number }) {
  const { trip, canEdit, writer } = useTrip()
  const budgets = useTripTable(trip.id, 'budgets')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [totalDraft, setTotalDraft] = useState<string>(trip.total_budget?.toString() ?? '')
  const cur = trip.currency
  const save = async (cat: BudgetCategory) => {
    const raw = draft[cat]
    if (raw === undefined) return
    const value = Math.max(0, Number(raw.replace(',', '.')) || 0)
    const existing = budgets.data?.find((b) => b.category === cat)
    if (existing) await writer.update('budgets', existing.id, { planned_amount: value })
    else await writer.insert('budgets', { trip_id: trip.id, category: cat, planned_amount: value })
    setDraft((d) => { const n = { ...d }; delete n[cat]; return n })
  }
  const sumCats = Object.values(plannedByCat).reduce((a, b) => a + b, 0)
  return (
    <Card>
      <CardHeader><CardTitle>Budget prévisionnel</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl bg-muted/60 p-3">
          <label htmlFor="total-budget" className="text-sm font-semibold">Budget global ({cur})</label>
          <div className="mt-1 flex gap-2">
            <Input id="total-budget" inputMode="decimal" placeholder={sumCats ? `${sumCats} (somme des catégories)` : 'ex. 1500'} value={totalDraft} disabled={!canEdit}
              onChange={(e) => setTotalDraft(e.target.value)}
              onBlur={() => canEdit && totalDraft !== (trip.total_budget?.toString() ?? '') && writer.update('trips', trip.id, { total_budget: totalDraft ? Number(totalDraft.replace(',', '.')) : null })} />
          </div>
          <Gauge value={total} max={trip.total_budget ?? sumCats} className="mt-3" label="Budget global consommé" />
          <p className="mt-1 text-xs text-muted-foreground">{fmtMoney(total, cur)} dépensés sur {fmtMoney(trip.total_budget ?? sumCats, cur)}</p>
        </div>
        <ul className="space-y-4">
          {(Object.keys(BUDGET_CATEGORIES) as BudgetCategory[]).map((c) => {
            const planned = plannedByCat[c] ?? 0
            const spent = spentByCat[c] ?? 0
            return (
              <li key={c} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-semibold">{BUDGET_CATEGORIES[c].emoji} {BUDGET_CATEGORIES[c].label}</span>
                  <span className="text-xs tabular text-muted-foreground">{fmtMoney(spent, cur, { compact: true })} /</span>
                  <Input className="h-8 w-24 text-right" inputMode="decimal" aria-label={`Prévu pour ${BUDGET_CATEGORIES[c].label}`} disabled={!canEdit}
                    value={draft[c] ?? (planned ? String(planned) : '')} placeholder="0"
                    onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} onBlur={() => save(c)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                </div>
                <Gauge value={spent} max={planned} label={`${BUDGET_CATEGORIES[c].label} : prévu vs dépensé`} />
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">La jauge passe à l’orange à 85 % et au rouge en cas de dépassement. Mise à jour : {fmtDay(isoDay())}.</p>
      </CardContent>
    </Card>
  )
}
