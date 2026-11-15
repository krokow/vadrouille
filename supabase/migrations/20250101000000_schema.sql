-- =====================================================================
-- Vadrouille — schéma principal
-- Toutes les tables ont id uuid, created_at, updated_at (+ updated_by).
-- Les tables d'un voyage portent toutes trip_id (RLS + filtrage temps réel).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profils
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Voyageur' check (char_length(display_name) between 1 and 60),
  avatar_url text,
  color text not null default '#1f6f8b',
  preferred_currency char(3) not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ---------------------------------------------------------------- voyages
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  destination text,
  lat double precision,
  lng double precision,
  start_date date,
  end_date date,
  currency char(3) not null default 'EUR',
  cover_url text,
  invite_token text not null default encode(gen_random_bytes(16), 'hex') unique,
  invite_enabled boolean not null default true,
  total_budget numeric(12,2),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint trips_dates_ok check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  color text not null default '#1f6f8b',
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  is_ghost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (trip_id, user_id)
);
create index on public.trip_members (user_id);
create index on public.trip_members (trip_id);

-- ---------------------------------------------------------------- lieux
create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  osm_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.places (trip_id);

-- ---------------------------------------------------------------- réservations
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  type text not null default 'other' check (type in ('flight','train','bus','car','lodging','restaurant','ticket','other')),
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  confirmation_code text,
  price numeric(12,2),
  currency char(3),
  status text not null default 'to_book' check (status in ('to_book','booked','confirmed','cancelled')),
  url text,
  notes text,
  booking_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.bookings (trip_id);

-- ---------------------------------------------------------------- activités
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  title text not null,
  description text,
  day_date date,                 -- null = idée non planifiée (wishlist)
  start_time time,
  end_time time,
  duration_min integer check (duration_min is null or duration_min >= 0),
  sort_order double precision not null default 0,
  est_cost numeric(12,2),
  currency char(3),
  category text not null default 'visit',
  needs_booking boolean not null default false,
  booking_status text check (booking_status in ('to_book','booked')),
  booking_deadline date,
  attention_notes jsonb not null default '{}'::jsonb,
  linked_booking_id uuid references public.bookings(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.activities (trip_id);

create table public.activity_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  label text,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.activity_links (trip_id);

-- votes 👍 (une ligne par participant, plutôt qu'un compteur : pas de conflit d'écriture)
create table public.activity_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (activity_id, member_id)
);
create index on public.activity_votes (trip_id);

create table public.activity_attendees (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (activity_id, member_id)
);
create index on public.activity_attendees (trip_id);

create table public.booking_attendees (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (booking_id, member_id)
);
create index on public.booking_attendees (trip_id);

-- ---------------------------------------------------------------- pièces jointes
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  parent_type text not null check (parent_type in ('activity','booking','expense','journal')),
  parent_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime text,
  size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.attachments (trip_id);
create index on public.attachments (parent_id);

-- ---------------------------------------------------------------- budget
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null,
  currency char(3) not null,
  fx_rate numeric(14,6) not null default 1 check (fx_rate > 0),
  amount_main numeric(12,2) not null,
  date date not null default current_date,
  category text not null default 'other' check (category in ('transport','lodging','food','activities','shopping','other')),
  paid_by uuid not null references public.trip_members(id) on delete restrict,
  split_mode text not null default 'equal' check (split_mode in ('equal','amount','shares')),
  booking_id uuid references public.bookings(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.expenses (trip_id);

create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete restrict,
  share_amount numeric(12,2) not null,
  weight numeric(8,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (expense_id, member_id)
);
create index on public.expense_shares (trip_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member uuid not null references public.trip_members(id) on delete restrict,
  to_member uuid not null references public.trip_members(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (from_member <> to_member)
);
create index on public.settlements (trip_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (category in ('transport','lodging','food','activities','shopping','other')),
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (trip_id, category)
);

-- ---------------------------------------------------------------- collaboration
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  parent_type text not null check (parent_type in ('activity','booking','expense','journal')),
  parent_id uuid not null,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.comments (trip_id);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('insert','update','delete')),
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_log (trip_id, created_at desc);

-- ---------------------------------------------------------------- extras
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null,
  group_name text not null default 'Général',
  assigned_to uuid references public.trip_members(id) on delete set null,
  done boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.checklist_items (trip_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_date date,
  body text not null default '',
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.journal_entries (trip_id);
