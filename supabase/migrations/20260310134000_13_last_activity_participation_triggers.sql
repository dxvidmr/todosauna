-- Actualizar last_activity_at unicamente cuando hay participacion real.

create or replace function public.touch_session_last_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.session_id is not null then
    update public.sesiones s
       set last_activity_at = now()
     where s.session_id = new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evaluaciones_touch_last_activity on public.evaluaciones;
create trigger trg_evaluaciones_touch_last_activity
after insert on public.evaluaciones
for each row
execute function public.touch_session_last_activity();

drop trigger if exists trg_testimonios_touch_last_activity on public.testimonios;
create trigger trg_testimonios_touch_last_activity
after insert on public.testimonios
for each row
execute function public.touch_session_last_activity();

drop trigger if exists trg_contribuciones_touch_last_activity on public.contribuciones_archivo;
create trigger trg_contribuciones_touch_last_activity
after insert on public.contribuciones_archivo
for each row
execute function public.touch_session_last_activity();

-- Backfill: para sesiones existentes, conservar solo la ultima actividad real
-- de participacion (evaluaciones, testimonios, contribuciones).
with participation_activity as (
  select
    a.session_id,
    max(a.activity_at) as last_participation_at
  from (
    select e.session_id, e.timestamp as activity_at
    from public.evaluaciones e
    union all
    select t.session_id, t.created_at as activity_at
    from public.testimonios t
    union all
    select c.session_id, c.created_at as activity_at
    from public.contribuciones_archivo c
  ) a
  group by a.session_id
)
update public.sesiones s
   set last_activity_at = pa.last_participation_at
  from participation_activity pa
 where s.session_id = pa.session_id;
