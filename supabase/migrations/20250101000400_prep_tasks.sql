-- =====================================================================
-- Vadrouille — préparatifs : la checklist sert aussi de todo-list d'avant départ
-- kind = 'pack' : affaires à emporter (existant) ; kind = 'task' : tâche à faire avant le départ
-- =====================================================================
alter table public.checklist_items
  add column if not exists kind text not null default 'pack' check (kind in ('pack', 'task')),
  add column if not exists due_date date;

create index if not exists checklist_items_kind_idx on public.checklist_items (trip_id, kind);
