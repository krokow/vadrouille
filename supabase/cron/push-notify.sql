-- Déclenche la Edge Function `push-notify` à chaque nouvelle entrée de l'historique (optionnel).
-- À exécuter dans Supabase > SQL Editor APRÈS avoir déployé la fonction :
--   supabase functions deploy push-notify --no-verify-jwt
-- Remplace <PROJECT_REF> et <PUSH_SECRET> (même valeur que le secret de la fonction).

create extension if not exists pg_net;
select vault.create_secret('<PUSH_SECRET>', 'vadrouille_push_secret');

create or replace function public.tg_push_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- pas de notification pour les simples modifications (trop bavard) ni pour les actions système
  if new.action = 'update' or new.actor_id is null then return new; end if;
  perform net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vadrouille_push_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end $$;

drop trigger if exists push_notify on public.activity_log;
create trigger push_notify after insert on public.activity_log
  for each row execute function public.tg_push_notify();

-- Pour arrêter : drop trigger push_notify on public.activity_log;
