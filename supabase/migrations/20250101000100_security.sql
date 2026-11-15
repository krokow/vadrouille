-- =====================================================================
-- Vadrouille — fonctions, triggers et politiques RLS
-- =====================================================================

-- ---------------------------------------------------------------- helpers (security definer)
create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = p_trip and user_id = auth.uid());
$$;

create or replace function public.can_edit_trip(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = p_trip and user_id = auth.uid() and role in ('owner','editor'));
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = p_trip and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.shares_trip_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trip_members a join trip_members b on a.trip_id = b.trip_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

create or replace function public.is_own_member(p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where id = p_member and user_id = auth.uid());
$$;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

revoke execute on function public.is_trip_member(uuid), public.can_edit_trip(uuid), public.is_trip_owner(uuid),
  public.shares_trip_with(uuid), public.is_own_member(uuid) from anon;

-- ---------------------------------------------------------------- triggers génériques
-- updated_at / updated_by (dernier écrit gagne)
create or replace function public.tg_stamp()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','trips','trip_members','places','bookings','activities','activity_links',
    'activity_votes','activity_attendees','booking_attendees','attachments','expenses','expense_shares',
    'settlements','budgets','comments','checklist_items','journal_entries']
  loop
    execute format('create trigger stamp before insert or update on public.%I for each row execute function public.tg_stamp()', t);
  end loop;
end $$;

-- Historique « qui a fait quoi » — regroupe les modifications successives d'un même élément (2 min)
create or replace function public.tg_log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_trip uuid;
  v_title text;
  v_last record;
begin
  r := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_trip := (r->>'trip_id')::uuid;
  if v_trip is null then return null; end if;
  -- voyage en cours de suppression : rien à journaliser
  if tg_op = 'DELETE' and not exists (select 1 from trips where id = v_trip) then return null; end if;
  -- simple réordonnancement : pas de bruit dans l'historique
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'sort_order' - 'updated_at' - 'updated_by' - 'day_date')
                       = (to_jsonb(old) - 'sort_order' - 'updated_at' - 'updated_by' - 'day_date')
                       and to_jsonb(new)->'day_date' is not distinct from to_jsonb(old)->'day_date' then
    return null;
  end if;
  v_title := left(coalesce(r->>'title', r->>'name', r->>'display_name', r->>'label', r->>'body', ''), 80);
  if tg_op = 'UPDATE' then
    select * into v_last from activity_log
      where trip_id = v_trip order by created_at desc limit 1;
    if found and v_last.entity_id = (r->>'id')::uuid and v_last.actor_id is not distinct from auth.uid()
       and v_last.created_at > now() - interval '2 minutes' then
      update activity_log set created_at = now(), payload = jsonb_build_object('title', v_title) where id = v_last.id;
      return null;
    end if;
  end if;
  insert into activity_log (trip_id, actor_id, action, entity_type, entity_id, payload)
  values (v_trip, auth.uid(), lower(tg_op), tg_table_name, (r->>'id')::uuid, jsonb_build_object('title', v_title));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['activities','bookings','expenses','trip_members','settlements','comments','places',
    'budgets','checklist_items','journal_entries']
  loop
    execute format('create trigger log_activity after insert or update or delete on public.%I for each row execute function public.tg_log_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- triggers métier
-- nouveau compte => profil
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  colors text[] := array['#1f6f8b','#ef7b62','#e9b44c','#5b8e7d','#8e6bbf','#d65d8c','#3c9d9b','#c77d3a','#6b8bd6','#7a9a3a','#b55252','#4f6d7a'];
  v_name text;
begin
  v_name := initcap(regexp_replace(split_part(coalesce(new.email, 'voyageur'), '@', 1), '[._-]+', ' ', 'g'));
  insert into profiles (id, display_name, color)
  values (new.id, left(coalesce(nullif(v_name, ''), 'Voyageur'), 60), colors[1 + abs(hashtext(new.id::text)) % array_length(colors, 1)])
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- le créateur d'un voyage en devient l'organisateur
create or replace function public.handle_new_trip()
returns trigger language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = new.created_by;
  insert into trip_members (trip_id, user_id, display_name, color, role, is_ghost)
  values (new.id, new.created_by, coalesce(p.display_name, 'Organisateur'), coalesce(p.color, '#1f6f8b'), 'owner', false);
  return new;
end $$;

create trigger on_trip_created after insert on public.trips
  for each row execute function public.handle_new_trip();

-- protections sur trips : created_by immuable, lien d'invitation réservé à l'organisateur
create or replace function public.tg_protect_trip()
returns trigger language plpgsql as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by est immuable';
  end if;
  if (new.invite_token is distinct from old.invite_token or new.invite_enabled is distinct from old.invite_enabled)
     and auth.uid() is not null and not public.is_trip_owner(old.id) then
    raise exception 'Seul l''organisateur peut gérer le lien d''invitation' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger protect_trip before update on public.trips
  for each row execute function public.tg_protect_trip();

-- protections sur trip_members : toujours au moins un organisateur
create or replace function public.tg_keep_one_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trips where id = old.trip_id) then
    return coalesce(new, old); -- voyage supprimé (cascade)
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (select 1 from trip_members where trip_id = old.trip_id and role = 'owner' and id <> old.id) then
      raise exception 'Le voyage doit garder au moins un organisateur' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger keep_one_owner before update or delete on public.trip_members
  for each row execute function public.tg_keep_one_owner();

-- le prénom et la couleur du profil se propagent aux participations
create or replace function public.tg_profile_propagate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.display_name is distinct from old.display_name or new.color is distinct from old.color then
    update trip_members set display_name = new.display_name, color = new.color where user_id = new.id;
  end if;
  return new;
end $$;

create trigger profile_propagate after update on public.profiles
  for each row execute function public.tg_profile_propagate();

-- ---------------------------------------------------------------- RPC invitation
-- aperçu d'un voyage à partir du jeton (avant de rejoindre)
create or replace function public.trip_preview(token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t trips;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into t from trips where invite_token = token and invite_enabled;
  if not found then raise exception 'Ce lien d''invitation n''est plus valide' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'id', t.id, 'name', t.name, 'destination', t.destination, 'start_date', t.start_date, 'end_date', t.end_date,
    'already_member', exists (select 1 from trip_members where trip_id = t.id and user_id = auth.uid()),
    'ghosts', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name))
                        from trip_members m where m.trip_id = t.id and m.is_ghost and m.user_id is null), '[]'::jsonb)
  );
end $$;

-- rejoindre (éventuellement en « reprenant » un participant fantôme)
create or replace function public.join_trip(token text, ghost_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t trips;
  p profiles;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into t from trips where invite_token = token and invite_enabled;
  if not found then raise exception 'Ce lien d''invitation n''est plus valide' using errcode = 'P0002'; end if;
  if exists (select 1 from trip_members where trip_id = t.id and user_id = v_uid) then
    return t.id;
  end if;
  select * into p from profiles where id = v_uid;
  if ghost_id is not null then
    update trip_members set user_id = v_uid, is_ghost = false, role = 'editor'
      where id = ghost_id and trip_id = t.id and is_ghost and user_id is null;
    if found then return t.id; end if;
  end if;
  insert into trip_members (trip_id, user_id, display_name, color, role, is_ghost)
  values (t.id, v_uid, coalesce(p.display_name, 'Invité'), coalesce(p.color, '#1f6f8b'), 'editor', false);
  return t.id;
end $$;

revoke execute on function public.join_trip(text, uuid), public.trip_preview(text) from anon;
grant execute on function public.join_trip(text, uuid), public.trip_preview(text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.activity_log enable row level security;
alter table public.comments enable row level security;
alter table public.activity_votes enable row level security;

-- profils : je vois le mien et ceux de mes compagnons de voyage
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip_with(id));
create policy "profiles_insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- voyages
create policy "trips_select" on public.trips for select to authenticated using (public.is_trip_member(id));
create policy "trips_insert" on public.trips for insert to authenticated with check (created_by = auth.uid());
create policy "trips_update" on public.trips for update to authenticated using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy "trips_delete" on public.trips for delete to authenticated using (public.is_trip_owner(id));

-- participants : lecture pour les membres, gestion par l'organisateur, chacun peut quitter
create policy "members_select" on public.trip_members for select to authenticated using (public.is_trip_member(trip_id));
create policy "members_insert" on public.trip_members for insert to authenticated with check (public.is_trip_owner(trip_id));
create policy "members_update" on public.trip_members for update to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy "members_delete" on public.trip_members for delete to authenticated using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- historique : lecture seule (écrit par trigger)
create policy "log_select" on public.activity_log for select to authenticated using (public.is_trip_member(trip_id));

-- commentaires : tout membre (même lecteur) peut commenter ; on modifie les siens
create policy "comments_select" on public.comments for select to authenticated using (public.is_trip_member(trip_id));
create policy "comments_insert" on public.comments for insert to authenticated with check (public.is_trip_member(trip_id) and author_id = auth.uid());
create policy "comments_update" on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid() and public.is_trip_member(trip_id));
create policy "comments_delete" on public.comments for delete to authenticated using (author_id = auth.uid() or public.can_edit_trip(trip_id));

-- votes : tout membre vote pour lui-même
create policy "votes_select" on public.activity_votes for select to authenticated using (public.is_trip_member(trip_id));
create policy "votes_insert" on public.activity_votes for insert to authenticated with check (public.is_trip_member(trip_id) and public.is_own_member(member_id));
create policy "votes_delete" on public.activity_votes for delete to authenticated using (public.is_own_member(member_id));

-- tables standard d'un voyage : lecture membres, écriture owner/editor
do $$
declare t text;
begin
  foreach t in array array['places','bookings','activities','activity_links','activity_attendees','booking_attendees',
    'attachments','expenses','expense_shares','settlements','budgets','checklist_items','journal_entries']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (public.can_edit_trip(trip_id))', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id))', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using (public.can_edit_trip(trip_id))', t, t);
  end loop;
end $$;

-- droits de base (Supabase les accorde déjà ; explicites pour la clarté)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------- nettoyage des commentaires / pièces jointes orphelins
create or replace function public.tg_cleanup_children()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from comments where parent_id = old.id;
  delete from attachments where parent_id = old.id;
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['activities','bookings','expenses','journal_entries']
  loop
    execute format('create trigger cleanup_children after delete on public.%I for each row execute function public.tg_cleanup_children()', t);
  end loop;
end $$;
