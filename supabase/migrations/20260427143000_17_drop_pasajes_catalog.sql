alter table public.evaluaciones
  drop constraint if exists evaluaciones_pasaje_id_fkey;

drop table if exists public.pasajes cascade;
drop sequence if exists public.pasajes_id_seq cascade;

comment on column public.evaluaciones.pasaje_id is 'Identificador local estable del pasaje derivado del XML base. No referencia una tabla catálogo.';
