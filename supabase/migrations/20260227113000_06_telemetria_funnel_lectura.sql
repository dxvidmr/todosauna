-- ============================================
-- Fase 10.2: Telemetria minima de embudo lectura
-- Dedupe por sesion + evento, sin limpieza automatica
-- ============================================

create table if not exists "public"."participacion_funnel_events" (
  "id" bigint generated always as identity primary key,
  "created_at" timestamp with time zone not null default now(),
  "session_id" uuid not null references "public"."sesiones"("session_id") on delete cascade,
  "event_name" text not null,
  "context" text not null default 'lectura',
  "metadata" jsonb not null default '{}'::jsonb,
  constraint "participacion_funnel_events_event_name_check"
    check (
      "event_name" in (
        'lectura_first_contribution',
        'lectura_second_prompt_opened',
        'lectura_second_prompt_choice_anonimo',
        'lectura_second_prompt_choice_colaborador',
        'lectura_second_prompt_abandoned'
      )
    ),
  constraint "participacion_funnel_events_session_event_key"
    unique ("session_id", "event_name")
);

create index if not exists "idx_participacion_funnel_events_created_at"
  on "public"."participacion_funnel_events" ("created_at" desc);

create index if not exists "idx_participacion_funnel_events_event_name_created_at"
  on "public"."participacion_funnel_events" ("event_name", "created_at" desc);

alter table "public"."participacion_funnel_events" enable row level security;

revoke all on table "public"."participacion_funnel_events" from public;
revoke all on table "public"."participacion_funnel_events" from "anon";
revoke all on table "public"."participacion_funnel_events" from "authenticated";

create or replace function "public"."rpc_track_participacion_funnel_event"(
  "p_session_id" uuid,
  "p_event_name" text,
  "p_context" text default 'lectura',
  "p_metadata" jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_name text;
  v_context text;
begin
  if p_session_id is null then
    raise exception 'session_id es obligatorio';
  end if;

  if not exists (
    select 1
    from "public"."sesiones" s
    where s."session_id" = p_session_id
  ) then
    raise exception 'session_id no encontrado';
  end if;

  v_event_name := trim(lower(coalesce(p_event_name, '')));

  if v_event_name not in (
    'lectura_first_contribution',
    'lectura_second_prompt_opened',
    'lectura_second_prompt_choice_anonimo',
    'lectura_second_prompt_choice_colaborador',
    'lectura_second_prompt_abandoned'
  ) then
    raise exception 'event_name invalido: %', p_event_name;
  end if;

  v_context := nullif(trim(coalesce(p_context, '')), '');
  if v_context is null then
    v_context := 'lectura';
  end if;

  insert into "public"."participacion_funnel_events" (
    "session_id",
    "event_name",
    "context",
    "metadata"
  )
  values (
    p_session_id,
    v_event_name,
    v_context,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict ("session_id", "event_name")
  do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

alter function "public"."rpc_track_participacion_funnel_event"(uuid, text, text, jsonb)
  owner to "postgres";

revoke all on function "public"."rpc_track_participacion_funnel_event"(uuid, text, text, jsonb)
  from public;

grant all on function "public"."rpc_track_participacion_funnel_event"(uuid, text, text, jsonb)
  to "anon";

grant all on function "public"."rpc_track_participacion_funnel_event"(uuid, text, text, jsonb)
  to "authenticated";

grant all on function "public"."rpc_track_participacion_funnel_event"(uuid, text, text, jsonb)
  to "service_role";
