-- =====================================================================
-- Vadrouille — documents du voyage (passeports, assurance…) avec visibilité restreinte
-- visibility = 'trip'    : visible par tous les membres
-- visibility = 'private' : visible uniquement par la personne qui l'a déposé
-- Fichiers privés stockés sous `trip_id/private/<user_id>/…`
-- =====================================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'other' check (kind in ('passport','id','insurance','visa','health','license','other')),
  visibility text not null default 'private' check (visibility in ('trip','private')),
  storage_path text,
  file_name text,
  mime text,
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index on public.documents (trip_id);

create trigger stamp before insert or update on public.documents for each row execute function public.tg_stamp();

grant select, insert, update, delete on public.documents to authenticated;
alter table public.documents enable row level security;
create policy "documents_select" on public.documents for select to authenticated
  using (public.is_trip_member(trip_id) and (visibility = 'trip' or owner_id = auth.uid()));
create policy "documents_insert" on public.documents for insert to authenticated
  with check (public.is_trip_member(trip_id) and owner_id = auth.uid());
create policy "documents_update" on public.documents for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_trip_member(trip_id));
create policy "documents_delete" on public.documents for delete to authenticated
  using (owner_id = auth.uid());

-- Storage : le sous-dossier `private/<uid>/` n'est lisible / modifiable que par son propriétaire
drop policy if exists "trip_files_select" on storage.objects;
drop policy if exists "trip_files_insert" on storage.objects;
drop policy if exists "trip_files_update" on storage.objects;
drop policy if exists "trip_files_delete" on storage.objects;

create or replace function public.can_access_trip_file(p_name text, p_write boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when (storage.foldername(p_name))[2] = 'private'
      then public.is_trip_member(public.try_uuid((storage.foldername(p_name))[1]))
           and (storage.foldername(p_name))[3] = auth.uid()::text
    when p_write then public.can_edit_trip(public.try_uuid((storage.foldername(p_name))[1]))
    else public.is_trip_member(public.try_uuid((storage.foldername(p_name))[1]))
  end;
$$;

create policy "trip_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and public.can_access_trip_file(name, false));
create policy "trip_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and public.can_access_trip_file(name, true));
create policy "trip_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'trip-files' and public.can_access_trip_file(name, true));
create policy "trip_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and public.can_access_trip_file(name, true));

-- temps réel (RLS appliquée : les documents privés ne sont diffusés qu'à leur propriétaire)
alter publication supabase_realtime add table public.documents;
