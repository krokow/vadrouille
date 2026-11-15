import type { Activity, Attendee, Booking, Expense, ExpenseShare } from '@/lib/types'
import { allocateCents, fromCents, spentPerMember, toCents } from './logic'

export interface PersonForecast {
  member_id: string
  spent: number
  upcoming: number
  total: number
}

export interface ForecastResult {
  people: PersonForecast[]
  totalSpent: number
  totalUpcoming: number
  /** devises sans taux connu (montants ignorés) */
  missingRates: string[]
}

/**
 * Budget par personne en direct : part réelle des dépenses + estimation de ce qui reste à payer
 * (réservations avec prix et activités avec coût estimé qui n'ont pas encore de dépense liée),
 * réparti entre les participants concernés (ou tout le monde).
 */
export function forecastPerPerson(input: {
  memberIds: string[]
  expenses: Expense[]
  shares: ExpenseShare[]
  activities: Activity[]
  bookings: Booking[]
  activityAttendees: Attendee[]
  bookingAttendees: Attendee[]
  mainCurrency: string
  rates: Record<string, number | undefined>
}): ForecastResult {
  const { memberIds, mainCurrency, rates } = input
  const spent = spentPerMember(input.expenses, input.shares)
  const upcoming: Record<string, number> = Object.fromEntries(memberIds.map((m) => [m, 0]))
  const missing = new Set<string>()
  const linkedActivities = new Set(input.expenses.map((e) => e.activity_id).filter(Boolean))
  const linkedBookings = new Set(input.expenses.map((e) => e.booking_id).filter(Boolean))
  const bookedActivities = new Set(input.activities.map((a) => a.linked_booking_id).filter(Boolean))

  const add = (amount: number, currency: string | null, who: string[]) => {
    const cur = currency ?? mainCurrency
    const rate = cur === mainCurrency ? 1 : rates[cur]
    if (!rate) {
      missing.add(cur)
      return
    }
    const targets = who.filter((w) => w in upcoming)
    const list = targets.length ? targets : memberIds
    const parts = allocateCents(toCents(amount * rate), list.map(() => 1))
    list.forEach((m, i) => (upcoming[m] = fromCents(toCents(upcoming[m]) + parts[i])))
  }

  for (const b of input.bookings) {
    if (b.price == null || b.status === 'cancelled' || linkedBookings.has(b.id)) continue
    add(Number(b.price), b.currency, input.bookingAttendees.filter((a) => a.booking_id === b.id).map((a) => a.member_id))
  }
  for (const a of input.activities) {
    // une activité déjà couverte par une réservation (ou une dépense) n'est pas comptée deux fois
    if (a.est_cost == null || !a.day_date || linkedActivities.has(a.id) || (a.linked_booking_id && bookedActivities.has(a.linked_booking_id))) continue
    add(Number(a.est_cost), a.currency, input.activityAttendees.filter((x) => x.activity_id === a.id).map((x) => x.member_id))
  }

  const people = memberIds.map((m) => {
    const s = spent[m] ?? 0
    const u = upcoming[m] ?? 0
    return { member_id: m, spent: s, upcoming: u, total: fromCents(toCents(s) + toCents(u)) }
  })
  return {
    people,
    totalSpent: fromCents(people.reduce((a, p) => a + toCents(p.spent), 0)),
    totalUpcoming: fromCents(people.reduce((a, p) => a + toCents(p.upcoming), 0)),
    missingRates: [...missing],
  }
}
