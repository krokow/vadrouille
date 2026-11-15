import type { Writer } from '@/lib/data'
import type { BudgetCategory, Expense, ExpenseShare } from '@/lib/types'
import { splitByWeights, splitEqual, toMain } from './logic'

export interface ExpenseInput {
  title: string
  amount: number
  currency: string
  fx_rate: number
  date: string
  category: BudgetCategory
  paid_by: string
  split_mode: Expense['split_mode']
  /** member_id → poids (mode shares) ou montant (mode amount) ; ignoré en mode equal */
  split: { member_id: string; value?: number }[]
  booking_id?: string | null
  activity_id?: string | null
  receipt_path?: string | null
}

export function computeShares(input: Pick<ExpenseInput, 'amount' | 'split_mode' | 'split'>): { member_id: string; share_amount: number; weight: number | null }[] {
  const { split } = input
  if (input.split_mode === 'amount') return split.map((s) => ({ member_id: s.member_id, share_amount: s.value ?? 0, weight: null }))
  if (input.split_mode === 'shares') {
    const weights = split.map((s) => s.value ?? 1)
    const parts = splitByWeights(input.amount, weights)
    return split.map((s, i) => ({ member_id: s.member_id, share_amount: parts[i], weight: weights[i] }))
  }
  const parts = splitEqual(input.amount, split.length)
  return split.map((s, i) => ({ member_id: s.member_id, share_amount: parts[i], weight: null }))
}

/** Crée ou remplace une dépense et ses parts */
export async function saveExpense(writer: Writer, tripId: string, input: ExpenseInput, existing?: { id: string; shares: ExpenseShare[] }) {
  const row: Partial<Expense> = {
    trip_id: tripId,
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    fx_rate: input.fx_rate,
    amount_main: toMain(input.amount, input.fx_rate),
    date: input.date,
    category: input.category,
    paid_by: input.paid_by,
    split_mode: input.split_mode,
    booking_id: input.booking_id ?? null,
    activity_id: input.activity_id ?? null,
    receipt_path: input.receipt_path ?? null,
  }
  let id = existing?.id
  if (existing) await writer.update('expenses', existing.id, row)
  else id = (await writer.insert('expenses', row)).id
  const shares = computeShares(input).filter((s) => s.share_amount !== 0 || input.split_mode !== 'amount')
  // remplace les parts : supprime celles qui ont disparu, met à jour / insère les autres
  const old = existing?.shares ?? []
  const keep = new Set(shares.map((s) => s.member_id))
  await Promise.all(old.filter((s) => !keep.has(s.member_id)).map((s) => writer.remove('expense_shares', s.id)))
  const toInsert: Partial<ExpenseShare>[] = []
  await Promise.all(
    shares.map((s) => {
      const prev = old.find((o) => o.member_id === s.member_id)
      if (prev) return Number(prev.share_amount) !== s.share_amount || prev.weight !== s.weight ? writer.update('expense_shares', prev.id, { share_amount: s.share_amount, weight: s.weight }) : null
      toInsert.push({ trip_id: tripId, expense_id: id!, member_id: s.member_id, share_amount: s.share_amount, weight: s.weight })
      return null
    }),
  )
  if (toInsert.length) await writer.insertMany('expense_shares', toInsert)
  return id!
}
