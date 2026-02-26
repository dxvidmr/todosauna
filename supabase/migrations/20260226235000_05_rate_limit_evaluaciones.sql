-- ============================================
-- Fase 8.3: Rate limit anti-flood en evaluaciones
-- Sin limite diario: solo rafaga por minuto
-- ============================================

alter table "public"."participacion_rate_limit_events"
  drop constraint if exists "participacion_rate_limit_events_action_check";

alter table "public"."participacion_rate_limit_events"
  add constraint "participacion_rate_limit_events_action_check"
  check ("action" in ('submit_testimonio', 'submit_contribucion', 'submit_evaluacion'));

create or replace function "public"."rpc_submit_participation_event"(
  "p_source" "text",
  "p_event_type" "text",
  "p_session_id" "uuid",
  "p_pasaje_id" integer default null::integer,
  "p_nota_id" "text" default null::"text",
  "p_nota_version" numeric default null::numeric,
  "p_target_xmlid" "text" default null::"text",
  "p_vote" "text" default null::"text",
  "p_selected_text" "text" default null::"text",
  "p_comment" "text" default null::"text"
)
returns table("id" integer)
language "plpgsql"
security definer
set "search_path" to 'public'
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
    nota_version,
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
    p_nota_version,
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

alter function "public"."rpc_submit_participation_event"(
  "p_source" "text",
  "p_event_type" "text",
  "p_session_id" "uuid",
  "p_pasaje_id" integer,
  "p_nota_id" "text",
  "p_nota_version" numeric,
  "p_target_xmlid" "text",
  "p_vote" "text",
  "p_selected_text" "text",
  "p_comment" "text"
) owner to "postgres";

revoke all on function "public"."rpc_submit_participation_event"(
  "p_source" "text",
  "p_event_type" "text",
  "p_session_id" "uuid",
  "p_pasaje_id" integer,
  "p_nota_id" "text",
  "p_nota_version" numeric,
  "p_target_xmlid" "text",
  "p_vote" "text",
  "p_selected_text" "text",
  "p_comment" "text"
) from public;

grant all on function "public"."rpc_submit_participation_event"(
  "p_source" "text",
  "p_event_type" "text",
  "p_session_id" "uuid",
  "p_pasaje_id" integer,
  "p_nota_id" "text",
  "p_nota_version" numeric,
  "p_target_xmlid" "text",
  "p_vote" "text",
  "p_selected_text" "text",
  "p_comment" "text"
) to "anon";

grant all on function "public"."rpc_submit_participation_event"(
  "p_source" "text",
  "p_event_type" "text",
  "p_session_id" "uuid",
  "p_pasaje_id" integer,
  "p_nota_id" "text",
  "p_nota_version" numeric,
  "p_target_xmlid" "text",
  "p_vote" "text",
  "p_selected_text" "text",
  "p_comment" "text"
) to "authenticated";

grant all on function "public"."rpc_submit_participation_event"(
  "p_source" "text",
  "p_event_type" "text",
  "p_session_id" "uuid",
  "p_pasaje_id" integer,
  "p_nota_id" "text",
  "p_nota_version" numeric,
  "p_target_xmlid" "text",
  "p_vote" "text",
  "p_selected_text" "text",
  "p_comment" "text"
) to "service_role";
