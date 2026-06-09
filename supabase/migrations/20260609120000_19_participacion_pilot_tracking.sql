-- ============================================
-- Telemetria temporal para piloto de participacion
-- Eventos de alta cardinalidad separados del funnel minimo
-- ============================================

create table if not exists "public"."participacion_pilot_settings" (
  "id" boolean primary key default true,
  "enabled" boolean not null default false,
  "updated_at" timestamp with time zone not null default now(),
  constraint "participacion_pilot_settings_singleton_check" check ("id" = true)
);

insert into "public"."participacion_pilot_settings" ("id", "enabled")
values (true, false)
on conflict ("id") do nothing;

create table if not exists "public"."participacion_pilot_events" (
  "id" bigint generated always as identity primary key,
  "created_at" timestamp with time zone not null default now(),
  "session_id" uuid not null references "public"."sesiones"("session_id") on delete cascade,
  "event_name" text not null,
  "context" text not null,
  "nota_id" text,
  "nota_change" text,
  "pasaje_id" integer,
  "form_name" text,
  "field_name" text,
  "event_key" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  constraint "participacion_pilot_events_event_name_check"
    check (
      "event_name" in (
        'note_unrated_view',
        'lab_passage_skipped',
        'form_started',
        'form_submitted',
        'form_abandoned'
      )
    ),
  constraint "participacion_pilot_events_context_check"
    check ("context" in ('lectura', 'laboratorio', 'formulario')),
  constraint "participacion_pilot_events_session_event_key"
    unique ("session_id", "event_key")
);

create index if not exists "idx_participacion_pilot_events_created_at"
  on "public"."participacion_pilot_events" ("created_at" desc);

create index if not exists "idx_participacion_pilot_events_event_context_created_at"
  on "public"."participacion_pilot_events" ("event_name", "context", "created_at" desc);

create index if not exists "idx_participacion_pilot_events_note"
  on "public"."participacion_pilot_events" ("context", "nota_id", "nota_change")
  where "nota_id" is not null;

create index if not exists "idx_participacion_pilot_events_form"
  on "public"."participacion_pilot_events" ("form_name", "event_name", "created_at" desc)
  where "form_name" is not null;

alter table "public"."participacion_pilot_settings" enable row level security;
alter table "public"."participacion_pilot_events" enable row level security;

revoke all on table "public"."participacion_pilot_settings" from public;
revoke all on table "public"."participacion_pilot_settings" from "anon";
revoke all on table "public"."participacion_pilot_settings" from "authenticated";

revoke all on table "public"."participacion_pilot_events" from public;
revoke all on table "public"."participacion_pilot_events" from "anon";
revoke all on table "public"."participacion_pilot_events" from "authenticated";

create or replace function "public"."rpc_track_participacion_pilot_event"(
  "p_session_id" uuid,
  "p_event_name" text,
  "p_context" text default 'formulario',
  "p_nota_id" text default null::text,
  "p_nota_change" text default null::text,
  "p_pasaje_id" integer default null::integer,
  "p_form_name" text default null::text,
  "p_field_name" text default null::text,
  "p_event_key" text default null::text,
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
  v_event_key text;
  v_metadata jsonb;
  v_inserted integer := 0;
begin
  if not exists (
    select 1
    from "public"."participacion_pilot_settings" s
    where s."id" = true
      and s."enabled" = true
  ) then
    return jsonb_build_object('ok', false, 'reason', 'pilot_disabled');
  end if;

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
    'note_unrated_view',
    'lab_passage_skipped',
    'form_started',
    'form_submitted',
    'form_abandoned'
  ) then
    raise exception 'event_name invalido: %', p_event_name;
  end if;

  v_context := trim(lower(coalesce(p_context, '')));
  if v_context not in ('lectura', 'laboratorio', 'formulario') then
    raise exception 'context invalido: %', p_context;
  end if;

  v_event_key := nullif(trim(coalesce(p_event_key, '')), '');
  if v_event_key is null then
    raise exception 'event_key es obligatorio';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    v_metadata := '{}'::jsonb;
  else
    v_metadata := p_metadata;
  end if;

  insert into "public"."participacion_pilot_events" (
    "session_id",
    "event_name",
    "context",
    "nota_id",
    "nota_change",
    "pasaje_id",
    "form_name",
    "field_name",
    "event_key",
    "metadata"
  )
  values (
    p_session_id,
    v_event_name,
    v_context,
    nullif(trim(coalesce(p_nota_id, '')), ''),
    nullif(trim(coalesce(p_nota_change, '')), ''),
    p_pasaje_id,
    nullif(trim(coalesce(p_form_name, '')), ''),
    nullif(trim(coalesce(p_field_name, '')), ''),
    v_event_key,
    v_metadata
  )
  on conflict ("session_id", "event_key")
  do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object('ok', true, 'inserted', v_inserted = 1);
end;
$$;

alter function "public"."rpc_track_participacion_pilot_event"(uuid, text, text, text, text, integer, text, text, text, jsonb)
  owner to "postgres";

revoke all on function "public"."rpc_track_participacion_pilot_event"(uuid, text, text, text, text, integer, text, text, text, jsonb)
  from public;

grant all on function "public"."rpc_track_participacion_pilot_event"(uuid, text, text, text, text, integer, text, text, text, jsonb)
  to "anon";

grant all on function "public"."rpc_track_participacion_pilot_event"(uuid, text, text, text, text, integer, text, text, text, jsonb)
  to "authenticated";

grant all on function "public"."rpc_track_participacion_pilot_event"(uuid, text, text, text, text, integer, text, text, text, jsonb)
  to "service_role";

grant all on table "public"."participacion_pilot_settings" to "service_role";
grant all on table "public"."participacion_pilot_events" to "service_role";
