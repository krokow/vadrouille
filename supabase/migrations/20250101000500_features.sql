-- =====================================================================
-- Vadrouille — fonctionnalités : répartition en %, album, lien invité,
-- comparateur d'options, notifications push
-- =====================================================================

-- ---------------------------------------------------------------- répartition en pourcentages
alter table public.expenses drop constraint if exists expenses_split_mode_check;
alter table public.expenses add constraint expenses_split_mode_check check (split_mode in ('equal', 'amount', 'shares', 'percent'));

-- ---------------------------------------------------------------- album photo partagé
alter table public.attachments drop constraint if exists attachments_parent_type_check;
alter table public.attachments add constraint attachments_parent_type_check check (parent_type in ('activity', 'booking', 'expense', 'journal', 'album'));
alter table public.comments drop constraint if exists comments_parent_type_check;
alter table public.comments add constraint comments_parent_type_check check (parent_type in ('activity', 'booking', 'expense', 'journal', 'album', 'option'));

-- ---------------------------------------------------------------- lien invité en lecture seule (sans compte)
alter table public.trips
  add column if not exists share_token text unique,
  add column if not exists share_enabled boolean not null default false;

-- seul l'organisateur gère le lien invité
create or replace function public.tg_protect_trip()
returns trigger language plpgsql as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by est immuable';
  end if;
  if (new.invite_token is distinct from old.invite_token or new.invite_enabled is distinct from old.invite_enabled
      or new.share_token is distinct from old.share_token or new.share_enabled is distinct from old.share_enabled)
     and auth.uid() is not null and not public.is_trip_owner(old.id) then
    raise exception 'Seul l''organisateur peut gérer les liens de partage' using errcode = '42501';
  end if;
  return new;
end $$;

-- Instantané public du voyage : programme, lieux, réservations SANS numéros de confirmation, prix ni budget
create or replace function public.public_trip(token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t trips;
begin
  select * into t from trips where share_token = token and share_enabled;
  if not found then raise exception 'Ce lien de partage n''est plus valide' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'trip', jsonb_build_object('id', t.id, 'name', t.name, 'destination', t.destination, 'lat', t.lat, 'lng', t.lng,
                               'start_date', t.start_date, 'end_date', t.end_date, 'currency', t.currency),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name, 'color', m.color) order by m.created_at)
                         from trip_members m where m.trip_id = t.id), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address, 'lat', p.lat, 'lng', p.lng))
                        from places p where p.trip_id = t.id), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description, 'day_date', a.day_date,
                              'start_time', a.start_time, 'end_time', a.end_time, 'category', a.category, 'place_id', a.place_id, 'sort_order', a.sort_order))
                            from activities a where a.trip_id = t.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'type', b.type, 'start_at', b.start_at, 'end_at', b.end_at,
                            'status', b.status, 'place_id', b.place_id))
                          from bookings b where b.trip_id = t.id and b.status <> 'cancelled'), '[]'::jsonb)
  );
end $$;
grant execute on function public.public_trip(text) to anon, authenticated;

-- ---------------------------------------------------------------- comparateur d'options
create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  group_name text not null check (char_length(group_name) between 1 and 120),
  title text not null check (char_length(title) between 1 and 200),
  url text,
  price numeric(12,2),
  currency char(3),
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  pros text,
  cons text,
  notes text,
  place_id uuid references public.places(id) on delete set null,
  chosen boolean not null default false,
  booking_id uuid references public.bookings(id) on delete set null,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists options_trip_idx on public.options (trip_id);

create table if not exists public.option_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  option_id uuid not null references public.options(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (option_id, member_id)
);
create index if not exists option_votes_trip_idx on public.option_votes (trip_id);

create trigger stamp before insert or update on public.options for each row execute function public.tg_stamp();
create trigger stamp before insert or update on public.option_votes for each row execute function public.tg_stamp();
create trigger log_activity after insert or update or delete on public.options for each row execute function public.tg_log_activity();

grant select, insert, update, delete on public.options, public.option_votes to authenticated;
alter table public.options enable row level security;
alter table public.option_votes enable row level security;
create policy "options_select" on public.options for select to authenticated using (public.is_trip_member(trip_id));
create policy "options_insert" on public.options for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "options_update" on public.options for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "options_delete" on public.options for delete to authenticated using (public.can_edit_trip(trip_id));
create policy "option_votes_select" on public.option_votes for select to authenticated using (public.is_trip_member(trip_id));
create policy "option_votes_insert" on public.option_votes for insert to authenticated with check (public.is_trip_member(trip_id) and public.is_own_member(member_id));
create policy "option_votes_delete" on public.option_votes for delete to authenticated using (public.is_own_member(member_id));

alter publication supabase_realtime add table public.options, public.option_votes;

-- ---------------------------------------------------------------- notifications push (Web Push)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
alter table public.push_subscriptions enable row level security;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
