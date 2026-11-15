import { describe, expect, it } from 'vitest'
import {
  evenPercents, percentGap, allocateCents, computeBalances, customSplitGap, simplifyDebts, splitByWeights, splitEqual, spentPerMember, toMain,
} from './logic'

describe('répartition', () => {
  it('parts égales qui tombent juste', () => {
    expect(splitEqual(90, 3)).toEqual([30, 30, 30])
  })
  it('parts égales avec centimes restants : la somme reste exacte', () => {
    const parts = splitEqual(100, 3)
    expect(parts).toEqual([33.34, 33.33, 33.33])
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10)
  })
  it('montant négatif (remboursement) réparti aussi', () => {
    expect(splitEqual(-10, 3)).toEqual([-3.34, -3.33, -3.33])
  })
  it('parts pondérées (2 adultes, 1 enfant)', () => {
    expect(splitByWeights(100, [2, 2, 1])).toEqual([40, 40, 20])
    const odd = splitByWeights(10, [1, 1, 1, 1, 1, 1, 1])
    expect(odd.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 10)
  })
  it('poids nuls ou liste vide', () => {
    expect(allocateCents(1000, [])).toEqual([])
    expect(allocateCents(1000, [0, 0])).toEqual([0, 0])
  })
  it('écart des montants personnalisés', () => {
    expect(customSplitGap(50, [20, 30])).toBe(0)
    expect(customSplitGap(50, [20, 25.5])).toBe(4.5)
    expect(customSplitGap(0.3, [0.1, 0.2])).toBe(0)
  })
  it('pourcentages égaux et écart à 100 %', () => {
    expect(evenPercents(3)).toEqual([33.34, 33.33, 33.33])
    expect(percentGap(evenPercents(7))).toBe(0)
    expect(percentGap([50, 30])).toBe(20)
  })
  it('conversion de devise arrondie au centime', () => {
    expect(toMain(100, 0.92345)).toBe(92.35)
    expect(toMain(19.99, 1)).toBe(19.99)
  })
})

describe('soldes', () => {
  const members = ['alice', 'bob', 'chloe']
  it('une dépense payée par Alice partagée à 3', () => {
    const b = computeBalances(
      members,
      [{ id: 'e1', amount_main: 90, paid_by: 'alice' }],
      members.map((m) => ({ expense_id: 'e1', member_id: m, share_amount: 30 })),
    )
    expect(b).toEqual({ alice: 60, bob: -30, chloe: -30 })
  })
  it('la somme des soldes est toujours nulle', () => {
    const expenses = [
      { id: 'e1', amount_main: 100, paid_by: 'alice' },
      { id: 'e2', amount_main: 47.11, paid_by: 'bob' },
      { id: 'e3', amount_main: 10, paid_by: 'chloe' },
    ]
    const shares = [
      ...splitEqual(100, 3).map((s, i) => ({ expense_id: 'e1', member_id: members[i], share_amount: s })),
      ...splitEqual(47.11, 2).map((s, i) => ({ expense_id: 'e2', member_id: members[i + 1], share_amount: s })),
      { expense_id: 'e3', member_id: 'alice', share_amount: 10 },
    ]
    const b = computeBalances(members, expenses, shares)
    const sum = Object.values(b).reduce((a, v) => a + Math.round(v * 100), 0)
    expect(sum).toBe(0)
  })
  it('dépense en devise étrangère : parts converties au taux figé', () => {
    // 100 USD à 0.9 => 90 EUR, partagés 50/50 en USD
    const b = computeBalances(
      ['a', 'b'],
      [{ id: 'e1', amount_main: 90, paid_by: 'a' }],
      [
        { expense_id: 'e1', member_id: 'a', share_amount: 50 },
        { expense_id: 'e1', member_id: 'b', share_amount: 50 },
      ],
    )
    expect(b).toEqual({ a: 45, b: -45 })
  })
  it('un remboursement solde la dette', () => {
    const b = computeBalances(
      ['a', 'b'],
      [{ id: 'e1', amount_main: 40, paid_by: 'a' }],
      [
        { expense_id: 'e1', member_id: 'a', share_amount: 20 },
        { expense_id: 'e1', member_id: 'b', share_amount: 20 },
      ],
      [{ from_member: 'b', to_member: 'a', amount: 20 }],
    )
    expect(b).toEqual({ a: 0, b: 0 })
  })
  it('une dépense sans répartition est ignorée', () => {
    const b = computeBalances(['a'], [{ id: 'e1', amount_main: 40, paid_by: 'a' }], [])
    expect(b).toEqual({ a: 0 })
  })
  it('part de chacun dans les dépenses', () => {
    expect(
      spentPerMember(
        [{ id: 'e1', amount_main: 90 }],
        [
          { expense_id: 'e1', member_id: 'a', share_amount: 60 },
          { expense_id: 'e1', member_id: 'b', share_amount: 30 },
        ],
      ),
    ).toEqual({ a: 60, b: 30 })
  })
})

describe('simplification des dettes', () => {
  const applied = (balances: Record<string, number>) => {
    const t = simplifyDebts(balances)
    const after: Record<string, number> = { ...balances }
    for (const x of t) {
      after[x.from] = Math.round((after[x.from] + x.amount) * 100) / 100
      after[x.to] = Math.round((after[x.to] - x.amount) * 100) / 100
    }
    return { t, after }
  }
  it('aucun virement si tout est équilibré', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([])
  })
  it('chaîne A→B→C simplifiée en un seul virement', () => {
    // A doit 10 à B, B doit 10 à C => A paie C directement
    const { t } = applied({ a: -10, b: 0, c: 10 })
    expect(t).toEqual([{ from: 'a', to: 'c', amount: 10 }])
  })
  it('tous les soldes reviennent à zéro, avec au plus n-1 virements', () => {
    const balances = { a: 60, b: -30, c: -20.5, d: -9.5, e: 0 }
    const { t, after } = applied(balances)
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
    expect(t.length).toBeLessThanOrEqual(4)
    expect(t.every((x) => x.amount > 0)).toBe(true)
  })
  it('cas aléatoires : toujours équilibré', () => {
    for (let run = 0; run < 200; run++) {
      const n = 2 + (run % 7)
      const cents = Array.from({ length: n - 1 }, () => Math.round((Math.random() - 0.5) * 20000))
      cents.push(-cents.reduce((a, b) => a + b, 0))
      const balances = Object.fromEntries(cents.map((c, i) => [`m${i}`, c / 100]))
      const { t, after } = applied(balances)
      expect(Object.values(after).every((v) => v === 0)).toBe(true)
      expect(t.length).toBeLessThanOrEqual(n - 1)
    }
  })
})
