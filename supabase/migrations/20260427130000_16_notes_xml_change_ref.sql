truncate table public.evaluaciones restart identity;

drop view if exists public.notas_activas;
drop table if exists public.notas cascade;
drop sequence if exists public.notas_id_seq cascade;

alter table public.evaluaciones
  drop column if exists nota_version,
  add column if not exists nota_change text;

drop index if exists public.idx_evaluaciones_nota;
create index if not exists idx_evaluaciones_nota
  on public.evaluaciones using btree (nota_id, nota_change);

drop function if exists public.rpc_get_note_eval_counts();
create or replace function public.rpc_get_note_eval_counts()
returns table(
  nota_id text,
  nota_change text,
  total bigint,
  utiles bigint,
  mejorables bigint
)
language sql
security definer
set search_path to 'public'
as $$
  select
    e.nota_id,
    e.nota_change,
    count(*)::bigint as total,
    count(*) filter (where e.vote = 'up')::bigint as utiles,
    count(*) filter (where e.vote = 'down')::bigint as mejorables
  from public.evaluaciones e
  where e.event_type = 'nota_eval'
    and e.nota_id is not null
    and e.nota_change is not null
  group by e.nota_id, e.nota_change;
$$;

alter function public.rpc_get_note_eval_counts() owner to postgres;
revoke all on function public.rpc_get_note_eval_counts() from public;
grant all on function public.rpc_get_note_eval_counts() to anon;
grant all on function public.rpc_get_note_eval_counts() to authenticated;
grant all on function public.rpc_get_note_eval_counts() to service_role;

drop function if exists public.rpc_get_session_evaluated_notes(uuid);
create or replace function public.rpc_get_session_evaluated_notes(p_session_id uuid)
returns table(
  nota_id text,
  nota_change text
)
language sql
security definer
set search_path to 'public'
as $$
  select distinct e.nota_id, e.nota_change
  from public.evaluaciones e
  where e.session_id = p_session_id
    and e.nota_id is not null
    and e.nota_change is not null;
$$;

alter function public.rpc_get_session_evaluated_notes(uuid) owner to postgres;
revoke all on function public.rpc_get_session_evaluated_notes(uuid) from public;
grant all on function public.rpc_get_session_evaluated_notes(uuid) to anon;
grant all on function public.rpc_get_session_evaluated_notes(uuid) to authenticated;
grant all on function public.rpc_get_session_evaluated_notes(uuid) to service_role;

drop function if exists public.rpc_submit_participation_event(text, text, uuid, integer, text, numeric, text, text, text, text);
drop function if exists public.rpc_submit_participation_event(text, text, uuid, integer, text, text, text, text, text, text);
create or replace function public.rpc_submit_participation_event(
  p_source text,
  p_event_type text,
  p_session_id uuid,
  p_pasaje_id integer default null::integer,
  p_nota_id text default null::text,
  p_nota_change text default null::text,
  p_target_xmlid text default null::text,
  p_vote text default null::text,
  p_selected_text text default null::text,
  p_comment text default null::text
)
returns table(id integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id integer;
  v_event text;
  v_vote text;
  v_ip_hash text;
begin
  v_event := trim(lower(coalesce(p_event_type, '')));
  v_vote := trim(lower(coalesce(p_vote, '')));

  if p_session_id is null then
    raise exception 'session_id es obligatorio';
  end if;

  if v_event not in ('nota_eval', 'falta_nota') then
    raise exception 'event_type invalido: %', p_event_type;
  end if;

  if v_event = 'nota_eval' then
    if p_nota_id is null or length(trim(p_nota_id)) = 0 then
      raise exception 'nota_id es obligatorio para nota_eval';
    end if;
    if p_nota_change is null or length(trim(p_nota_change)) = 0 then
      raise exception 'nota_change es obligatorio para nota_eval';
    end if;
    if v_vote not in ('up', 'down') then
      raise exception 'vote invalido para nota_eval';
    end if;
  end if;

  v_ip_hash := public._request_ip_hash();

  perform public._assert_rate_limit(
    'submit_evaluacion',
    p_session_id,
    v_ip_hash,
    12,
    60,
    interval '1 minute'
  );

  insert into public.evaluaciones (
    timestamp,
    source,
    event_type,
    session_id,
    pasaje_id,
    nota_id,
    nota_change,
    target_xmlid,
    vote,
    selected_text,
    comment
  )
  values (
    now(),
    nullif(trim(coalesce(p_source, '')), ''),
    v_event,
    p_session_id,
    p_pasaje_id,
    nullif(trim(coalesce(p_nota_id, '')), ''),
    nullif(trim(coalesce(p_nota_change, '')), ''),
    nullif(trim(coalesce(p_target_xmlid, '')), ''),
    case when v_vote = '' then null else v_vote end,
    nullif(trim(coalesce(p_selected_text, '')), ''),
    nullif(trim(coalesce(p_comment, '')), '')
  )
  returning evaluaciones.id
  into v_id;

  insert into public.participacion_rate_limit_events (
    action,
    session_id,
    ip_hash
  )
  values (
    'submit_evaluacion',
    p_session_id,
    v_ip_hash
  );

  return query
  select v_id;
end;
$$;

alter function public.rpc_submit_participation_event(text, text, uuid, integer, text, text, text, text, text, text) owner to postgres;

revoke all on function public.rpc_submit_participation_event(text, text, uuid, integer, text, text, text, text, text, text) from public;
grant all on function public.rpc_submit_participation_event(text, text, uuid, integer, text, text, text, text, text, text) to anon;
grant all on function public.rpc_submit_participation_event(text, text, uuid, integer, text, text, text, text, text, text) to authenticated;
grant all on function public.rpc_submit_participation_event(text, text, uuid, integer, text, text, text, text, text, text) to service_role;
