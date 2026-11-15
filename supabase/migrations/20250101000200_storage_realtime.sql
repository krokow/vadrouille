-- =====================================================================
-- Vadrouille — Storage et Realtime
-- =====================================================================

-- bucket privé pour les fichiers d'un voyage : chemins `trip_id/…`
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-files', 'trip-files', false, 10485760)
on conflict (id) do nothing;

-- bucket public pour les avatars : chemins `user_id/…`
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "trip_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and public.is_trip_member(public.try_uuid((storage.foldername(name))[1])));
create policy "trip_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and public.can_edit_trip(public.try_uuid((storage.foldername(name))[1])));
create policy "trip_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'trip-files' and public.can_edit_trip(public.try_uuid((storage.foldername(name))[1])));
create policy "trip_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and public.can_edit_trip(public.try_uuid((storage.foldername(name))[1])));

create policy "avatars_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime : diffuse les changements (Realtime applique les politiques RLS à chaque abonné)
do $$
declare t text;
begin
  foreach t in array array['profiles','trips','trip_members','places','bookings','activities','activity_links',
    'activity_votes','activity_attendees','booking_attendees','attachments','expenses','expense_shares',
    'settlements','budgets','comments','activity_log','checklist_items','journal_entries']
  loop
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;
