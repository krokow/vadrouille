import { addDays } from 'date-fns'
import { backend } from '@/lib/backend'
import { uid, randomToken } from '@/lib/ids'
import { isoDay } from '@/lib/format'

/** Crée un voyage d'exemple complet (même contenu que supabase/seed.sql) pour découvrir l'app */
export async function createSampleTrip(userId: string): Promise<string> {
  const t = uid()
  const d0 = addDays(new Date(), 21)
  const day = (n: number) => isoDay(addDays(d0, n))
  const at = (n: number, hm: string) => new Date(`${day(n)}T${hm}:00`).toISOString()
  await backend.insert('trips', {
    id: t, name: 'Lisbonne entre amis (exemple)', destination: 'Lisbonne, Portugal', lat: 38.7223, lng: -9.1393,
    start_date: day(0), end_date: day(4), currency: 'EUR', created_by: userId, invite_token: randomToken(), invite_enabled: true,
    total_budget: 1800, notes: 'Logement : Rua dos Remédios 12, code boîte à clés 2486.\nUrgences : 112', cover_url: null,
  })
  const [me] = await backend.select('trip_members', { trip_id: t, user_id: userId })
  const friend = uid()
  const kid = uid()
  await backend.insert('trip_members', [
    { id: friend, trip_id: t, user_id: null, display_name: 'Camille', color: '#ef7b62', role: 'viewer', is_ghost: true },
    { id: kid, trip_id: t, user_id: null, display_name: 'Léo (8 ans)', color: '#e9b44c', role: 'viewer', is_ghost: true },
  ])
  const P = { tram: uid(), belem: uid(), hotel: uid(), sintra: uid(), market: uid() }
  await backend.insert('places', [
    { id: P.tram, trip_id: t, name: 'Tram 28 – Martim Moniz', address: 'Praça Martim Moniz, Lisbonne', lat: 38.7155, lng: -9.1365, osm_id: null },
    { id: P.belem, trip_id: t, name: 'Pastéis de Belém', address: 'Rua de Belém 84, Lisbonne', lat: 38.6975, lng: -9.2032, osm_id: null },
    { id: P.hotel, trip_id: t, name: 'Appartement Alfama', address: 'Rua dos Remédios 12, Lisbonne', lat: 38.7119, lng: -9.1281, osm_id: null },
    { id: P.sintra, trip_id: t, name: 'Palais de Pena', address: 'Estrada da Pena, Sintra', lat: 38.7876, lng: -9.3906, osm_id: null },
    { id: P.market, trip_id: t, name: 'Time Out Market', address: 'Av. 24 de Julho 49, Lisbonne', lat: 38.7069, lng: -9.1459, osm_id: null },
  ])
  const flight = uid()
  const hotel = uid()
  await backend.insert('bookings', [
    { id: flight, trip_id: t, place_id: null, type: 'flight', title: 'Vol Paris-Orly → Lisbonne', start_at: at(0, '07:10'), end_at: at(0, '08:55'), confirmation_code: 'TP8K2Q', price: 384, currency: 'EUR', status: 'confirmed', url: null, notes: null, booking_deadline: null },
    { id: hotel, trip_id: t, place_id: P.hotel, type: 'lodging', title: 'Appartement Alfama', start_at: at(0, '15:00'), end_at: at(4, '11:00'), confirmation_code: 'HM4PZ9QK', price: 520, currency: 'EUR', status: 'booked', url: null, notes: 'Check-in à partir de 15h', booking_deadline: null },
    { id: uid(), trip_id: t, place_id: null, type: 'restaurant', title: 'Dîner fado à Alfama', start_at: null, end_at: null, confirmation_code: null, price: 140, currency: 'EUR', status: 'to_book', url: null, notes: null, booking_deadline: isoDay(addDays(new Date(), 5)) },
  ])
  const sintra = uid()
  const tram = uid()
  const surf = uid()
  const base = { description: null, end_time: null, duration_min: null, linked_booking_id: null, notes: null, currency: 'EUR' }
  await backend.insert('activities', [
    { ...base, id: tram, trip_id: t, place_id: P.tram, title: 'Balade en tram 28', description: 'Le tram jaune mythique, de Martim Moniz à Prazeres.', day_date: day(1), start_time: '08:30', sort_order: 1000, category: 'visit', needs_booking: false, booking_status: null, booking_deadline: null, attention_notes: { best_time: 'Avant 9h pour avoir une place assise', other: 'Attention aux pickpockets' }, est_cost: 12 },
    { ...base, id: uid(), trip_id: t, place_id: P.belem, title: 'Pastéis de Belém', description: 'Goûter les vrais pastéis de nata.', day_date: day(1), start_time: '15:00', sort_order: 2000, category: 'food', needs_booking: false, booking_status: null, booking_deadline: null, attention_notes: {}, est_cost: 15 },
    { ...base, id: sintra, trip_id: t, place_id: P.sintra, title: 'Journée à Sintra – Palais de Pena', description: 'Train depuis Rossio (40 min).', day_date: day(2), start_time: '09:30', sort_order: 1000, category: 'culture', needs_booking: true, booking_status: 'to_book', booking_deadline: isoDay(addDays(new Date(), 3)), attention_notes: { opening_hours: '9h30–18h30', gear: 'Chaussures de marche, coupe-vent', weather: 'Brumeux le matin' }, est_cost: 80 },
    { ...base, id: uid(), trip_id: t, place_id: P.market, title: 'Dîner au Time Out Market', day_date: day(2), start_time: '20:00', sort_order: 2000, category: 'food', needs_booking: false, booking_status: null, booking_deadline: null, attention_notes: {}, est_cost: 90 },
    { ...base, id: surf, trip_id: t, place_id: null, title: 'Surf à Costa da Caparica', description: 'Cours d’initiation 2h.', day_date: null, start_time: null, sort_order: 1000, category: 'sport', needs_booking: true, booking_status: 'to_book', booking_deadline: null, attention_notes: { gear: 'Maillot, crème solaire' }, est_cost: 35 },
    { ...base, id: uid(), trip_id: t, place_id: null, title: 'Musée des Azulejos', day_date: null, start_time: null, sort_order: 2000, category: 'culture', needs_booking: false, booking_status: null, booking_deadline: null, attention_notes: { closed_days: 'Fermé le lundi' }, est_cost: 5 },
  ])
  await backend.insert('activity_links', [
    { trip_id: t, activity_id: sintra, label: 'Billetterie', url: 'https://www.parquesdesintra.pt/' },
    { trip_id: t, activity_id: tram, label: 'Horaires', url: 'https://www.carris.pt/' },
  ])
  if (me) await backend.insert('activity_votes', { trip_id: t, activity_id: surf, member_id: me.id })
  const e1 = uid()
  const e2 = uid()
  const payer = me?.id ?? friend
  await backend.insert('expenses', [
    { id: e1, trip_id: t, title: 'Vols A/R', amount: 384, currency: 'EUR', fx_rate: 1, amount_main: 384, date: isoDay(addDays(new Date(), -10)), category: 'transport', paid_by: payer, split_mode: 'equal', booking_id: flight, activity_id: null, receipt_path: null },
    { id: e2, trip_id: t, title: 'Appartement Alfama', amount: 520, currency: 'EUR', fx_rate: 1, amount_main: 520, date: isoDay(addDays(new Date(), -8)), category: 'lodging', paid_by: friend, split_mode: 'equal', booking_id: hotel, activity_id: null, receipt_path: null },
  ])
  await backend.insert('expense_shares', [
    { trip_id: t, expense_id: e1, member_id: payer, share_amount: 128, weight: null },
    { trip_id: t, expense_id: e1, member_id: friend, share_amount: 128, weight: null },
    { trip_id: t, expense_id: e1, member_id: kid, share_amount: 128, weight: null },
    { trip_id: t, expense_id: e2, member_id: payer, share_amount: 173.34, weight: null },
    { trip_id: t, expense_id: e2, member_id: friend, share_amount: 173.33, weight: null },
    { trip_id: t, expense_id: e2, member_id: kid, share_amount: 173.33, weight: null },
  ])
  await backend.insert('budgets', (['transport', 'lodging', 'food', 'activities', 'shopping'] as const).map((category, i) => ({ trip_id: t, category, planned_amount: [450, 550, 450, 250, 100][i] })))
  await backend.insert('checklist_items', ['Passeport / carte d’identité', 'Chargeur + batterie externe', 'Crème solaire', 'Chaussures de marche'].map((label, i) => ({ trip_id: t, kind: 'pack' as const, label, group_name: i === 0 ? 'Papiers' : 'Affaires', sort_order: i + 1, done: false, assigned_to: null })))
  await backend.insert('checklist_items', [
    { label: 'Souscrire une assurance voyage', before: 30, done: true },
    { label: 'Vérifier la validité des cartes d’identité', before: 14, done: false },
    { label: 'Télécharger la carte de Lisbonne hors ligne', before: 3, done: false },
    { label: 'Enregistrement en ligne du vol', before: 1, done: false },
  ].map((x, i) => ({ trip_id: t, kind: 'task' as const, label: x.label, group_name: 'Tâches', due_date: day(-x.before), done: x.done, assigned_to: i === 3 ? me?.id ?? null : null, sort_order: 10 + i })))
  return t
}
