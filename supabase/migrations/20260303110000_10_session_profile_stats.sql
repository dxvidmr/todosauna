drop function if exists public.rpc_get_session_stats(uuid);

create function public.rpc_get_session_stats(p_session_id uuid)
returns table (
  total_contribuciones bigint,
  total_evaluaciones bigint,
  votos_up bigint,
  votos_down bigint,
  comentarios bigint,
  total_sugerencias bigint,
  total_testimonios bigint,
  total_contribuciones_archivo bigint,
  total_envios bigint
)
language sql
security definer
set search_path to 'public'
as $$
  with session_evals as (
    select event_type, vote, comment
    from public.evaluaciones
    where session_id = p_session_id
  ),
  totals as (
    select
      count(*) filter (where event_type = 'nota_eval')::bigint as total_evaluaciones,
      count(*) filter (where event_type = 'nota_eval' and vote = 'up')::bigint as votos_up,
      count(*) filter (where event_type = 'nota_eval' and vote = 'down')::bigint as votos_down,
      count(*) filter (
        where event_type = 'nota_eval'
          and comment is not null
          and length(trim(comment)) > 0
      )::bigint as comentarios,
      count(*) filter (where event_type = 'falta_nota')::bigint as total_sugerencias
    from session_evals
  ),
  testimonios_count as (
    select count(*)::bigint as total_testimonios
    from public.testimonios
    where session_id = p_session_id
  ),
  archivo_count as (
    select count(*)::bigint as total_contribuciones_archivo
    from public.contribuciones_archivo
    where session_id = p_session_id
  )
  select
    (
      coalesce(t.total_evaluaciones, 0)
      + coalesce(t.total_sugerencias, 0)
      + coalesce(tc.total_testimonios, 0)
      + coalesce(ac.total_contribuciones_archivo, 0)
    )::bigint as total_contribuciones,
    coalesce(t.total_evaluaciones, 0)::bigint as total_evaluaciones,
    coalesce(t.votos_up, 0)::bigint as votos_up,
    coalesce(t.votos_down, 0)::bigint as votos_down,
    coalesce(t.comentarios, 0)::bigint as comentarios,
    coalesce(t.total_sugerencias, 0)::bigint as total_sugerencias,
    coalesce(tc.total_testimonios, 0)::bigint as total_testimonios,
    coalesce(ac.total_contribuciones_archivo, 0)::bigint as total_contribuciones_archivo,
    (coalesce(tc.total_testimonios, 0) + coalesce(ac.total_contribuciones_archivo, 0))::bigint as total_envios
  from totals t
  cross join testimonios_count tc
  cross join archivo_count ac;
$$;

alter function public.rpc_get_session_stats(uuid) owner to postgres;

revoke all on function public.rpc_get_session_stats(uuid) from public;
grant all on function public.rpc_get_session_stats(uuid) to anon;
grant all on function public.rpc_get_session_stats(uuid) to authenticated;
grant all on function public.rpc_get_session_stats(uuid) to service_role;
