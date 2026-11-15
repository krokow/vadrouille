import type { Expense, ExpenseShare, TripMember } from '@/lib/types'
import { BUDGET_CATEGORIES } from '@/lib/constants'

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const dec = (n: number) => n.toFixed(2).replace('.', ',')

/** CSV « à la française » (séparateur ; et virgule décimale) lisible directement dans Excel / LibreOffice */
export function expensesToCsv(expenses: Expense[], shares: ExpenseShare[], members: TripMember[], mainCurrency: string): string {
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? '?'
  const header = ['Date', 'Titre', 'Catégorie', 'Montant', 'Devise', 'Taux', `Montant (${mainCurrency})`, 'Payé par', ...members.map((m) => `Part ${m.display_name} (${mainCurrency})`)]
  const lines = [header.map(cell).join(';')]
  for (const e of [...expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    const ex = shares.filter((s) => s.expense_id === e.id)
    const total = ex.reduce((s, x) => s + Number(x.share_amount), 0)
    const per = members.map((m) => {
      const s = ex.find((x) => x.member_id === m.id)
      return s && total ? dec((Number(s.share_amount) / total) * Number(e.amount_main)) : ''
    })
    lines.push([e.date, e.title, BUDGET_CATEGORIES[e.category]?.label ?? e.category, dec(Number(e.amount)), e.currency, String(e.fx_rate).replace('.', ','), dec(Number(e.amount_main)), name(e.paid_by), ...per].map(cell).join(';'))
  }
  return '﻿' + lines.join('\r\n')
}
