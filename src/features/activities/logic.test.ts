import { describe, expect, it } from 'vitest'
import { buildTodo } from './logic'
import type { Activity, Booking } from '@/lib/types'

const today = new Date(2025, 4, 10)
const act = (p: Partial<Activity>): Activity => ({
  id: p.id ?? p.title!, trip_id: 't', place_id: null, title: 'x', description: null, day_date: null, start_time: null, end_time: null,
  duration_min: null, sort_order: 0, est_cost: null, currency: null, category: 'visit', needs_booking: false, booking_status: null,
  booking_deadline: null, attention_notes: {}, linked_booking_id: null, notes: null, created_at: '', updated_at: '', ...p,
})
const book = (p: Partial<Booking>): Booking => ({
  id: p.title!, trip_id: 't', place_id: null, type: 'other', title: 'b', start_at: null, end_at: null, confirmation_code: null,
  price: null, currency: null, status: 'to_book', url: null, notes: null, booking_deadline: null, created_at: '', updated_at: '', ...p,
})

describe('onglet À réserver', () => {
  it('une activité à réserver avec deadline remonte, triée par urgence', () => {
    const todo = buildTodo(
      [
        act({ title: 'Musée', needs_booking: true, booking_status: 'to_book', booking_deadline: '2025-06-01' }),
        act({ title: 'Alhambra', needs_booking: true, booking_status: 'to_book', booking_deadline: '2025-05-12' }),
        act({ title: 'Déjà réservé', needs_booking: true, booking_status: 'booked', booking_deadline: '2025-05-11' }),
        act({ title: 'Balade', needs_booking: false }),
        act({ title: 'En retard', needs_booking: true, booking_status: 'to_book', booking_deadline: '2025-05-01' }),
      ],
      [book({ title: 'Hôtel', status: 'to_book', booking_deadline: '2025-05-15' }), book({ title: 'Vol', status: 'confirmed' })],
      today,
    )
    expect(todo.map((t) => t.title)).toEqual(['En retard', 'Alhambra', 'Hôtel', 'Musée'])
    expect(todo.map((t) => t.urgency)).toEqual(['overdue', 'soon', 'soon', 'later'])
  })
  it('sans deadline : la date de l’activité sert d’échéance', () => {
    const [t] = buildTodo([act({ title: 'Resto', needs_booking: true, booking_status: 'to_book', day_date: '2025-05-11' })], [], today)
    expect(t.deadline).toBe('2025-05-11')
    expect(t.urgency).toBe('soon')
  })
})
