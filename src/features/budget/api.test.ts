import { describe, expect, it } from 'vitest'
import { computeShares } from './api'
import { expensesToCsv } from './csv'
import type { Expense, ExpenseShare, TripMember } from '@/lib/types'

describe('computeShares', () => {
  const split = [{ member_id: 'a', value: 2 }, { member_id: 'b', value: 1 }, { member_id: 'c', value: 1 }]
  it('parts égales', () => {
    expect(computeShares({ amount: 10, split_mode: 'equal', split }).map((s) => s.share_amount)).toEqual([3.34, 3.33, 3.33])
  })
  it('par parts (poids conservés)', () => {
    const r = computeShares({ amount: 100, split_mode: 'shares', split })
    expect(r.map((s) => s.share_amount)).toEqual([50, 25, 25])
    expect(r.map((s) => s.weight)).toEqual([2, 1, 1])
  })
  it('montants personnalisés', () => {
    expect(computeShares({ amount: 4, split_mode: 'amount', split }).map((s) => s.share_amount)).toEqual([2, 1, 1])
  })
})

describe('export CSV', () => {
  it('format français avec parts par personne', () => {
    const members = [{ id: 'a', display_name: 'Alice' }, { id: 'b', display_name: 'Bob' }] as TripMember[]
    const e = { id: 'e', date: '2025-05-12', title: 'Dîner; vin', category: 'food', amount: 50, currency: 'USD', fx_rate: 0.9, amount_main: 45, paid_by: 'a' } as Expense
    const shares = [{ expense_id: 'e', member_id: 'a', share_amount: 25 }, { expense_id: 'e', member_id: 'b', share_amount: 25 }] as ExpenseShare[]
    const csv = expensesToCsv([e], shares, members, 'EUR')
    const [head, row] = csv.replace('﻿', '').split('\r\n')
    expect(head).toBe('Date;Titre;Catégorie;Montant;Devise;Taux;Montant (EUR);Payé par;Part Alice (EUR);Part Bob (EUR)')
    expect(row).toBe('2025-05-12;"Dîner; vin";Nourriture;50,00;USD;0,9;45,00;Alice;22,50;22,50')
  })
})
