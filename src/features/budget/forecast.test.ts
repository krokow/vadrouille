import { describe, expect, it } from 'vitest'
import { forecastPerPerson } from './forecast'
import type { Activity, Booking, Expense, ExpenseShare } from '@/lib/types'

describe('budget par personne en direct', () => {
  it('dépensé + à venir, sans double comptage', () => {
    const r = forecastPerPerson({
      memberIds: ['a', 'b'],
      expenses: [{ id: 'e1', amount_main: 100, booking_id: 'b1', activity_id: null } as Expense],
      shares: [{ expense_id: 'e1', member_id: 'a', share_amount: 50 }, { expense_id: 'e1', member_id: 'b', share_amount: 50 }] as ExpenseShare[],
      bookings: [
        { id: 'b1', price: 100, currency: 'EUR', status: 'booked' } as Booking, // déjà payé → ignoré
        { id: 'b2', price: 60, currency: 'EUR', status: 'to_book' } as Booking, // à venir, pour tout le monde
        { id: 'b3', price: 30, currency: 'USD', status: 'booked' } as Booking, // converti (0,9)
        { id: 'b4', price: 999, currency: 'EUR', status: 'cancelled' } as Booking,
      ],
      activities: [
        { id: 'x1', est_cost: 20, currency: 'EUR', day_date: '2025-05-12', linked_booking_id: null } as Activity, // seulement pour b
        { id: 'x2', est_cost: 50, currency: 'EUR', day_date: null, linked_booking_id: null } as Activity, // idée → ignorée
        { id: 'x3', est_cost: 10, currency: 'JPY', day_date: '2025-05-12', linked_booking_id: null } as Activity, // taux inconnu
      ],
      activityAttendees: [{ activity_id: 'x1', member_id: 'b' }] as never,
      bookingAttendees: [],
      mainCurrency: 'EUR',
      rates: { USD: 0.9 },
    })
    expect(r.people).toEqual([
      { member_id: 'a', spent: 50, upcoming: 43.5, total: 93.5 },
      { member_id: 'b', spent: 50, upcoming: 63.5, total: 113.5 },
    ])
    expect(r.totalUpcoming).toBe(107)
    expect(r.missingRates).toEqual(['JPY'])
  })
})
