-- Planification quotidienne de la Edge Function `deadline-reminders` (optionnel).
-- À exécuter dans Supabase > SQL Editor APRÈS avoir déployé la fonction :
--   supabase functions deploy deadline-reminders --no-verify-jwt
-- Remplace <PROJECT_REF> et <CRON_SECRET> (même valeur que le secret de la fonction).
-- Le secret est stocké dans Supabase Vault, il n'apparaît pas dans ce dépôt.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET>', 'vadrouille_cron_secret');

select cron.schedule(
  'vadrouille-deadline-reminders',
  '0 7 * * *', -- tous les jours à 7h UTC
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/deadline-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vadrouille_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pour arrêter : select cron.unschedule('vadrouille-deadline-reminders');
