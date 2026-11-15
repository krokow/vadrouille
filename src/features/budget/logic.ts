/**
 * Logique métier du budget : répartition des dépenses, soldes, simplification des dettes.
 * Tous les calculs se font en centimes (entiers) pour éviter les erreurs d'arrondi.
 */
import type { Expense, ExpenseShare, Settlement } from '@/lib/types'

export const toCents = (n: number) => Math.round(n * 100)
export const fromCents = (c: number) => c / 100

/**
 * Répartit `totalCents` selon des poids, par la méthode des plus forts restes :
 * la somme des parts est toujours exactement égale au total.
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  if (!weights.length) return []
  const sumW = weights.reduce((a, b) => a + b, 0)
  if (sumW <= 0) return weights.map(() => 0)
  const sign = totalCents < 0 ? -1 : 1
  const abs = Math.abs(totalCents)
  const raw = weights.map((w) => (abs * w) / sumW)
  const floors = raw.map(Math.floor)
  let rest = abs - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (rest <= 0) break
    floors[i] += 1
    rest -= 1
  }
  return floors.map((c) => c * sign)
}

/** Parts égales (en unités monétaires) */
export function splitEqual(total: number, count: number): number[] {
  return allocateCents(toCents(total), Array(count).fill(1)).map(fromCents)
}

/** Parts pondérées, ex. 2 parts pour un adulte, 1 pour un enfant */
export function splitByWeights(total: number, weights: number[]): number[] {
  return allocateCents(toCents(total), weights).map(fromCents)
}

/** Écart entre la somme des montants personnalisés et le total (0 = OK) */
export function customSplitGap(total: number, amounts: number[]): number {
  return fromCents(toCents(total) - amounts.reduce((a, b) => a + toCents(b), 0))
}

export type Balances = Record<string, number>

/**
 * Solde de chaque participant dans la devise principale :
 * positif = on lui doit de l'argent, négatif = il doit de l'argent.
 */
export function computeBalances(
  memberIds: string[],
  expenses: Pick<Expense, 'id' | 'amount_main' | 'paid_by'>[],
  shares: Pick<ExpenseShare, 'expense_id' | 'member_id' | 'share_amount'>[],
  settlements: Pick<Settlement, 'from_member' | 'to_member' | 'amount'>[] = [],
): Balances {
  const cents: Record<string, number> = {}
  for (const id of memberIds) cents[id] = 0
  const byExpense = new Map<string, typeof shares>()
  for (const s of shares) {
    const list = byExpense.get(s.expense_id) ?? []
    list.push(s)
    byExpense.set(s.expense_id, list)
  }
  for (const e of expenses) {
    const parts = byExpense.get(e.id) ?? []
    const totalMain = toCents(e.amount_main)
    if (!parts.length) continue // dépense non répartie : ignorée dans les soldes
    cents[e.paid_by] = (cents[e.paid_by] ?? 0) + totalMain
    // les parts sont saisies dans la devise de la dépense : on convertit proportionnellement
    const alloc = allocateCents(totalMain, parts.map((p) => Math.max(0, p.share_amount)))
    parts.forEach((p, i) => {
      cents[p.member_id] = (cents[p.member_id] ?? 0) - alloc[i]
    })
  }
  for (const s of settlements) {
    const c = toCents(s.amount)
    cents[s.from_member] = (cents[s.from_member] ?? 0) + c
    cents[s.to_member] = (cents[s.to_member] ?? 0) - c
  }
  const out: Balances = {}
  for (const [k, v] of Object.entries(cents)) out[k] = fromCents(v)
  return out
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

/**
 * Simplification des dettes : produit une liste courte de virements qui remet tous les soldes à zéro.
 * Algorithme glouton (plus gros débiteur → plus gros créancier) : au plus n-1 virements.
 */
export function simplifyDebts(balances: Balances): Transfer[] {
  const debtors: { id: string; c: number }[] = []
  const creditors: { id: string; c: number }[] = []
  for (const [id, v] of Object.entries(balances)) {
    const c = toCents(v)
    if (c < 0) debtors.push({ id, c: -c })
    else if (c > 0) creditors.push({ id, c })
  }
  const byAmount = (a: { id: string; c: number }, b: { id: string; c: number }) => b.c - a.c || a.id.localeCompare(b.id)
  debtors.sort(byAmount)
  creditors.sort(byAmount)
  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].c, creditors[j].c)
    if (pay > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: fromCents(pay) })
    debtors[i].c -= pay
    creditors[j].c -= pay
    if (debtors[i].c === 0) i++
    if (creditors[j].c === 0) j++
  }
  return transfers
}

/** Montant converti dans la devise principale */
export function toMain(amount: number, fxRate: number): number {
  return fromCents(Math.round(amount * fxRate * 100))
}

export function totalsBy<T>(items: T[], key: (t: T) => string, value: (t: T) => number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of items) {
    const k = key(it)
    out[k] = fromCents((toCents(out[k] ?? 0)) + toCents(value(it)))
  }
  return out
}

/** Ce que chaque participant a réellement « consommé » (sa part des dépenses) */
export function spentPerMember(
  expenses: Pick<Expense, 'id' | 'amount_main'>[],
  shares: Pick<ExpenseShare, 'expense_id' | 'member_id' | 'share_amount'>[],
): Record<string, number> {
  const noSettlements: Settlement[] = []
  const payerless = expenses.map((e) => ({ ...e, paid_by: '__none__' }))
  const b = computeBalances([], payerless, shares, noSettlements)
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(b)) if (k !== '__none__') out[k] = -v
  return out
}

/** Pourcentages égaux qui totalisent exactement 100 (2 décimales) */
export function evenPercents(n: number): number[] {
  return allocateCents(10000, Array(n).fill(1)).map(fromCents)
}

/** Écart des pourcentages par rapport à 100 (0 = OK) */
export function percentGap(percents: number[]): number {
  return fromCents(10000 - percents.reduce((a, b) => a + toCents(b), 0))
}
