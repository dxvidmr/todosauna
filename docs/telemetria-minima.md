# Telemetria minima de lectura (F10.2)

## Objetivo
Registrar eventos clave del embudo de participacion en lectura con baja cardinalidad y dedupe por sesion.

## Fuente de datos
- Tabla: `public.participacion_funnel_events`
- Ingestion: RPC `public.rpc_track_participacion_funnel_event(...)`
- Dedupe: `unique(session_id, event_name)` en DB.

## Diccionario de eventos
- `lectura_first_contribution`: primera contribucion en lectura dentro de la sesion.
- `lectura_second_prompt_opened`: se abre el modal al intentar una segunda contribucion sin modo definido.
- `lectura_second_prompt_choice_anonimo`: el usuario elige continuar en anonimo desde ese modal.
- `lectura_second_prompt_choice_colaborador`: el usuario elige colaborador (login o registro) desde ese modal.
- `lectura_second_prompt_abandoned`: el modal se cierra sin definir modo.

## Consultas SQL de revision
Conteo diario por evento:

```sql
select
  date_trunc('day', created_at) as day,
  event_name,
  count(*) as total
from public.participacion_funnel_events
group by 1, 2
order by 1 desc, 2 asc;
```

Embudo agregado (total historico):

```sql
select event_name, count(*) as total
from public.participacion_funnel_events
group by event_name
order by total desc;
```

Ultimos eventos (debug):

```sql
select
  created_at,
  session_id,
  event_name,
  context,
  metadata
from public.participacion_funnel_events
order by created_at desc
limit 100;
```

## Operacion manual: exportar y purgar
1. Exportar antes de borrar:
```sql
copy (
  select *
  from public.participacion_funnel_events
  order by created_at asc
) to stdout with csv header;
```
2. Purgar por antiguedad:
```sql
delete from public.participacion_funnel_events
where created_at < now() - interval '180 days';
```
3. Verificar volumen restante:
```sql
select count(*) as total_rows
from public.participacion_funnel_events;
```

## Notas de privacidad
- No se guarda email, IP ni datos personales directos.
- Solo se almacena `session_id`, `event_name`, `context` y `metadata` minima.
- No se crean cookies nuevas; se reutiliza la sesion existente.
