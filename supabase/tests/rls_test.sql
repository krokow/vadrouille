-- Tests des politiques RLS. Chaque bloc doit afficher PASS ; le script s'arrête à la première erreur.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.fr'),
  ('00000000-0000-0000-0000-00000000000c', 'chloe@test.fr'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@test.fr');

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- profils créés par trigger
select pg_temp.check((select count(*) from profiles) = 4, 'profils créés automatiquement');
select pg_temp.check((select display_name from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'prénom déduit de l''e-mail');

-- Alice crée un voyage
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, created_by, invite_token) values ('11111111-1111-1111-1111-111111111111', 'Lisbonne', auth.uid(), 'tok-lisbonne');
select pg_temp.check((select role from trip_members where trip_id = '11111111-1111-1111-1111-111111111111' and user_id = auth.uid()) = 'owner', 'le créateur devient organisateur');
insert into activities (trip_id, title, needs_booking, booking_status, booking_deadline)
  values ('11111111-1111-1111-1111-111111111111', 'Tram 28', true, 'to_book', current_date + 3);
insert into trip_members (trip_id, display_name, is_ghost) values ('11111111-1111-1111-1111-111111111111', 'Léo (enfant)', true);
select pg_temp.check((select count(*) from activity_log where trip_id = '11111111-1111-1111-1111-111111111111') >= 2, 'historique alimenté');

-- Eve, non membre, ne voit rien
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) from trips) = 0, 'non-membre : aucun voyage visible');
select pg_temp.check((select count(*) from activities) = 0, 'non-membre : aucune activité visible');
select pg_temp.check((select count(*) from trip_members) = 0, 'non-membre : aucun participant visible');
select pg_temp.check((select count(*) from activity_log) = 0, 'non-membre : aucun historique visible');
select pg_temp.check((select count(*) from profiles) = 1, 'non-membre : ne voit que son propre profil');
do $$ begin
  insert into activities (trip_id, title) values ('11111111-1111-1111-1111-111111111111', 'Intrusion');
  raise exception 'FAIL: un non-membre a pu écrire';
exception when insufficient_privilege then raise notice 'PASS: non-membre : écriture refusée';
end $$;
update trips set name = 'Piraté' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.check((select name from trips where id = '11111111-1111-1111-1111-111111111111') = 'Lisbonne', 'non-membre : modification sans effet');

-- mauvais jeton
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin
  perform join_trip('mauvais-jeton');
  raise exception 'FAIL: jeton invalide accepté';
exception when no_data_found then raise notice 'PASS: jeton invalide refusé';
end $$;

-- Bob rejoint par lien : éditeur
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((trip_preview('tok-lisbonne')->>'name') = 'Lisbonne', 'aperçu du voyage par jeton');
select pg_temp.check(join_trip('tok-lisbonne') = '11111111-1111-1111-1111-111111111111', 'Bob rejoint par le lien');
select pg_temp.check((select role from trip_members where user_id = auth.uid()) = 'editor', 'rôle éditeur par défaut');
select pg_temp.check((select count(*) from activities) = 1, 'membre : voit les activités');
select pg_temp.check((select count(*) from profiles) = 2, 'membre : voit le profil des compagnons');
update activities set title = 'Tram 28 (tôt le matin)';
select pg_temp.check((select title from activities limit 1) = 'Tram 28 (tôt le matin)', 'éditeur : peut modifier une activité');
select pg_temp.check((select updated_by from activities limit 1) = auth.uid(), 'updated_by renseigné');
-- l'éditeur ne peut pas gérer les membres ni le lien
update trip_members set role = 'owner' where user_id = auth.uid();
reset role;
select pg_temp.check((select role from trip_members where user_id = '00000000-0000-0000-0000-00000000000b') = 'editor', 'éditeur : ne peut pas se promouvoir');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  update trips set invite_token = 'vol' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: éditeur a changé le lien';
exception when insufficient_privilege then raise notice 'PASS: éditeur : ne peut pas régénérer le lien';
end $$;
delete from trips where id = '11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.check((select count(*) from trips) = 1, 'éditeur : ne peut pas supprimer le voyage');

-- Chloé rejoint en reprenant le participant fantôme, puis passe lectrice
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(jsonb_array_length(trip_preview('tok-lisbonne')->'ghosts') = 1, 'aperçu : fantôme proposé');
select join_trip('tok-lisbonne', (select (trip_preview('tok-lisbonne')->'ghosts'->0->>'id')::uuid));
select pg_temp.check((select display_name from trip_members where user_id = auth.uid()) = 'Léo (enfant)', 'fantôme relié au compte');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update trip_members set role = 'viewer' where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  insert into activities (trip_id, title) values ('11111111-1111-1111-1111-111111111111', 'Lecture seule ?');
  raise exception 'FAIL: lecteur a pu écrire';
exception when insufficient_privilege then raise notice 'PASS: lecteur : écriture refusée';
end $$;
insert into comments (trip_id, parent_type, parent_id, author_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'activity', (select id from activities limit 1), auth.uid(), 'Trop bien !');
select pg_temp.check((select count(*) from comments) = 1, 'lecteur : peut commenter');
insert into activity_votes (trip_id, activity_id, member_id)
  values ('11111111-1111-1111-1111-111111111111', (select id from activities limit 1), (select id from trip_members where user_id = auth.uid()));
select pg_temp.check((select count(*) from activity_votes) = 1, 'lecteur : peut voter pour lui-même');
do $$ begin
  insert into activity_votes (trip_id, activity_id, member_id)
    values ('11111111-1111-1111-1111-111111111111', (select id from activities limit 1),
            (select id from trip_members where user_id = '00000000-0000-0000-0000-00000000000b'));
  raise exception 'FAIL: vote au nom d''un autre';
exception when insufficient_privilege then raise notice 'PASS: impossible de voter au nom d''un autre';
end $$;

-- Storage
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values ('trip-files', '11111111-1111-1111-1111-111111111111/billet.pdf');
select pg_temp.check((select count(*) from storage.objects) = 1, 'storage : membre éditeur peut déposer un fichier');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) from storage.objects) = 0, 'storage : non-membre ne voit pas les fichiers');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('trip-files', '11111111-1111-1111-1111-111111111111/intrus.pdf');
  raise exception 'FAIL: storage intrus';
exception when insufficient_privilege then raise notice 'PASS: storage : non-membre ne peut pas déposer';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/a.png');
  raise exception 'FAIL: avatar d''un autre';
exception when insufficient_privilege then raise notice 'PASS: avatars : chacun son dossier';
end $$;

-- documents à visibilité restreinte
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into documents (trip_id, owner_id, title, kind, visibility, storage_path)
  values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'Passeport Alice', 'passport', 'private',
          '11111111-1111-1111-1111-111111111111/private/00000000-0000-0000-0000-00000000000a/passeport.pdf');
insert into documents (trip_id, owner_id, title, kind, visibility)
  values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'Assurance groupe', 'insurance', 'trip');
insert into storage.objects (bucket_id, name) values ('trip-files', '11111111-1111-1111-1111-111111111111/private/00000000-0000-0000-0000-00000000000a/passeport.pdf');
select pg_temp.check((select count(*) from documents) = 2, 'documents : le propriétaire voit ses documents privés');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from documents) = 1, 'documents : un autre membre ne voit que les documents partagés');
select pg_temp.check((select count(*) from storage.objects where name like '%/private/%') = 0, 'storage : fichier privé invisible pour les autres membres');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('trip-files', '11111111-1111-1111-1111-111111111111/private/00000000-0000-0000-0000-00000000000a/faux.pdf');
  raise exception 'FAIL: dépôt dans le dossier privé d''un autre';
exception when insufficient_privilege then raise notice 'PASS: storage : impossible d''écrire dans le dossier privé d''un autre';
end $$;
update documents set title = 'Piraté';
reset role;
select pg_temp.check((select count(*) from documents where title = 'Piraté') = 0, 'documents : seul le propriétaire modifie');

-- préparatifs (tâches d'avant départ)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into checklist_items (trip_id, label, kind, due_date) values ('11111111-1111-1111-1111-111111111111', 'Souscrire l''assurance', 'task', current_date + 10);
select pg_temp.check((select count(*) from checklist_items where kind = 'task') = 1, 'préparatifs : tâche créée');
reset role;

-- lien invité, options, push
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  update trips set share_token = 'pub', share_enabled = true where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: éditeur a activé le lien invité';
exception when insufficient_privilege then raise notice 'PASS: lien invité réservé à l''organisateur';
end $$;
insert into options (trip_id, group_name, title, price) values ('11111111-1111-1111-1111-111111111111', 'Hôtel', 'Hôtel A', 120);
select pg_temp.check((select count(*) from options) = 1, 'options : éditeur peut proposer une option');
insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://push/bob', 'k', 'a');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update trips set share_token = 'pub-lisbonne', share_enabled = true where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select count(*) from push_subscriptions) = 0, 'push : chacun ne voit que ses abonnements');
reset role;
set role anon;
select pg_temp.check((public_trip('pub-lisbonne')->'trip'->>'name') = 'Lisbonne', 'invité sans compte : instantané public lisible');
select pg_temp.check(not (public_trip('pub-lisbonne')::text like '%confirmation%'), 'invité : pas de numéros de confirmation');
do $$ begin
  perform 1 from trips;
  raise exception 'FAIL: anon lit la table trips';
exception when insufficient_privilege then raise notice 'PASS: anon ne lit pas les tables directement';
end $$;
reset role;
update trips set share_enabled = false where id = '11111111-1111-1111-1111-111111111111';
set role anon;
do $$ begin
  perform public_trip('pub-lisbonne');
  raise exception 'FAIL: lien désactivé encore valide';
exception when no_data_found then raise notice 'PASS: lien invité désactivé refusé';
end $$;
reset role;

-- garder un organisateur
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  delete from trip_members where user_id = auth.uid();
  raise exception 'FAIL: dernier organisateur supprimé';
exception when insufficient_privilege then raise notice 'PASS: le dernier organisateur ne peut pas partir';
end $$;

-- propagation du prénom
update profiles set display_name = 'Alice D.' where id = auth.uid();
select pg_temp.check((select display_name from trip_members where user_id = auth.uid()) = 'Alice D.', 'prénom propagé aux participations');

-- l'organisateur retire Bob puis supprime le voyage
delete from trip_members where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from trips) = 0, 'membre retiré : plus d''accès');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from trips where id = '11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.check((select count(*) from trips) = 0 and (select count(*) from activities) = 0, 'organisateur : suppression en cascade');

-- seed de démo
select pg_temp.check(seed_demo_trip('00000000-0000-0000-0000-00000000000e') is not null, 'seed : voyage de démo créé');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) from activities) = 6 and (select count(*) from trip_members) = 3, 'seed : contenu visible par son propriétaire');
reset role;

\echo 'Tous les tests RLS sont passés ✅'
