-- =====================================================================
-- Vadrouille — données de démonstration
-- Crée la fonction seed_demo_trip(user_id) qui génère un voyage complet
-- (Lisbonne) pour un utilisateur existant. Dates relatives à aujourd'hui.
--
-- Utilisation (SQL Editor, après t'être connecté une première fois à l'app) :
--   select public.seed_demo_trip((select id from auth.users where email = 'toi@exemple.fr'));
-- =====================================================================

create or replace function public.seed_demo_trip(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t uuid := gen_random_uuid();
  d0 date := current_date + 21;
  me uuid;
  ghost uuid := gen_random_uuid();
  friend uuid := gen_random_uuid();
  p_tram uuid := gen_random_uuid();
  p_belem uuid := gen_random_uuid();
  p_hotel uuid := gen_random_uuid();
  p_sintra uuid := gen_random_uuid();
  p_time uuid := gen_random_uuid();
  a_tram uuid := gen_random_uuid();
  a_sintra uuid := gen_random_uuid();
  b_hotel uuid := gen_random_uuid();
  b_flight uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
begin
  if p_user is null then raise exception 'Utilisateur inconnu'; end if;
  insert into trips (id, name, destination, lat, lng, start_date, end_date, currency, created_by, total_budget, notes)
  values (t, 'Lisbonne entre amis (démo)', 'Lisbonne, Portugal', 38.7223, -9.1393, d0, d0 + 4, 'EUR', p_user, 1800,
          'Logement : Rua dos Remédios 12, code boîte à clés 2486.' || chr(10) || 'Urgences : 112');
  select id into me from trip_members where trip_id = t and user_id = p_user;

  insert into trip_members (id, trip_id, display_name, color, role, is_ghost) values
    (friend, t, 'Camille', '#ef7b62', 'viewer', true),
    (ghost, t, 'Léo (8 ans)', '#e9b44c', 'viewer', true);

  insert into places (id, trip_id, name, address, lat, lng) values
    (p_tram, t, 'Tram 28 – Martim Moniz', 'Praça Martim Moniz, Lisbonne', 38.7155, -9.1365),
    (p_belem, t, 'Pastéis de Belém', 'Rua de Belém 84, Lisbonne', 38.6975, -9.2032),
    (p_hotel, t, 'Appartement Alfama', 'Rua dos Remédios 12, Lisbonne', 38.7119, -9.1281),
    (p_sintra, t, 'Palais de Pena', 'Estrada da Pena, Sintra', 38.7876, -9.3906),
    (p_time, t, 'Time Out Market', 'Av. 24 de Julho 49, Lisbonne', 38.7069, -9.1459);

  insert into bookings (id, trip_id, place_id, type, title, start_at, end_at, confirmation_code, price, currency, status) values
    (b_flight, t, null, 'flight', 'Vol Paris-Orly → Lisbonne', (d0 + time '07:10') at time zone 'Europe/Paris', (d0 + time '08:55') at time zone 'Europe/Lisbon', 'TP8K2Q', 384, 'EUR', 'confirmed'),
    (b_hotel, t, p_hotel, 'lodging', 'Appartement Alfama', (d0 + time '15:00') at time zone 'Europe/Lisbon', (d0 + 4 + time '11:00') at time zone 'Europe/Lisbon', 'HM4PZ9QK', 520, 'EUR', 'booked');
  insert into bookings (trip_id, type, title, status, booking_deadline, price, currency)
    values (t, 'restaurant', 'Dîner fado à Alfama', 'to_book', current_date + 5, 140, 'EUR');

  insert into activities (id, trip_id, place_id, title, description, day_date, start_time, sort_order, category, needs_booking, booking_status, booking_deadline, attention_notes, est_cost, currency) values
    (a_tram, t, p_tram, 'Balade en tram 28', 'Le tram jaune mythique, de Martim Moniz à Prazeres.', d0 + 1, '08:30', 1000, 'visit', false, null, null,
      '{"best_time": "Avant 9h pour avoir une place assise", "other": "Attention aux pickpockets"}', 12, 'EUR'),
    (gen_random_uuid(), t, p_belem, 'Pastéis de Belém', 'Goûter les vrais pastéis de nata.', d0 + 1, '15:00', 2000, 'food', false, null, null, '{}', 15, 'EUR'),
    (a_sintra, t, p_sintra, 'Journée à Sintra – Palais de Pena', 'Train depuis Rossio (40 min).', d0 + 2, '09:30', 1000, 'culture', true, 'to_book', current_date + 3,
      '{"opening_hours": "9h30–18h30", "closed_days": "Ouvert tous les jours", "gear": "Chaussures de marche, coupe-vent", "weather": "Brumeux le matin"}', 80, 'EUR'),
    (gen_random_uuid(), t, p_time, 'Dîner au Time Out Market', null, d0 + 2, '20:00', 2000, 'food', false, null, null, '{}', 90, 'EUR'),
    (gen_random_uuid(), t, null, 'Surf à Costa da Caparica', 'Cours d’initiation 2h.', null, null, 1000, 'sport', true, 'to_book', null, '{"gear": "Maillot, crème solaire"}', 35, 'EUR'),
    (gen_random_uuid(), t, null, 'Musée des Azulejos', null, null, null, 2000, 'culture', false, null, null, '{"closed_days": "Fermé le lundi"}', 5, 'EUR');

  insert into activity_links (trip_id, activity_id, label, url) values
    (t, a_sintra, 'Billetterie', 'https://www.parquesdesintra.pt/'),
    (t, a_tram, 'Horaires', 'https://www.carris.pt/');
  insert into activity_votes (trip_id, activity_id, member_id)
    select t, a.id, me from activities a where a.trip_id = t and a.title like 'Surf%';

  insert into expenses (id, trip_id, title, amount, currency, fx_rate, amount_main, date, category, paid_by, booking_id) values
    (e1, t, 'Vols A/R', 384, 'EUR', 1, 384, current_date - 10, 'transport', me, b_flight),
    (e2, t, 'Appartement Alfama', 520, 'EUR', 1, 520, current_date - 8, 'lodging', friend, b_hotel);
  insert into expense_shares (trip_id, expense_id, member_id, share_amount) values
    (t, e1, me, 128), (t, e1, friend, 128), (t, e1, ghost, 128),
    (t, e2, me, 173.34), (t, e2, friend, 173.33), (t, e2, ghost, 173.33);

  insert into budgets (trip_id, category, planned_amount) values
    (t, 'transport', 450), (t, 'lodging', 550), (t, 'food', 450), (t, 'activities', 250), (t, 'shopping', 100);

  insert into checklist_items (trip_id, label, group_name, sort_order) values
    (t, 'Passeport / carte d’identité', 'Papiers', 1), (t, 'Carte européenne d’assurance maladie', 'Papiers', 2),
    (t, 'Chargeur + batterie externe', 'Électronique', 3), (t, 'Crème solaire', 'Trousse', 4), (t, 'Chaussures de marche', 'Vêtements', 5);
  insert into checklist_items (trip_id, kind, label, group_name, due_date, done, sort_order) values
    (t, 'task', 'Souscrire une assurance voyage', 'Tâches', d0 - 30, true, 10),
    (t, 'task', 'Vérifier la validité des cartes d’identité', 'Tâches', d0 - 14, false, 11),
    (t, 'task', 'Télécharger la carte de Lisbonne hors ligne', 'Tâches', d0 - 3, false, 12),
    (t, 'task', 'Enregistrement en ligne du vol', 'Tâches', d0 - 1, false, 13);

  return t;
end $$;

revoke execute on function public.seed_demo_trip(uuid) from anon, authenticated;
