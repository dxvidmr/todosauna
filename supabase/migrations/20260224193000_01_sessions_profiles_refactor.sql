-- ============================================
-- PHASE 1: sessions model cleanup + collaborator profile expansion
-- ============================================

-- Replace legacy rpc_create_session before dropping session columns.
drop function if exists "public"."rpc_create_session"(boolean, uuid, text, text);

-- ============================================
-- sesiones: remove legacy collaborator flag and session demographics
-- ============================================

create extension if not exists "pgcrypto";

alter table "public"."sesiones"
  add column if not exists "modo_participacion" text not null,
  add column if not exists "browser_session_token" uuid not null default gen_random_uuid(),
  add column if not exists "modal_lectura_post_first_shown" boolean not null default false,
  add column if not exists "last_activity_at" timestamp with time zone not null default now();

drop index if exists "public"."idx_sesiones_es_colaborador";
drop index if exists "public"."idx_sesiones_nivel_estudios";
drop index if exists "public"."idx_sesiones_disciplina";

alter table "public"."sesiones"
  drop column if exists "es_colaborador",
  drop column if exists "nivel_estudios",
  drop column if exists "disciplina";

alter table "public"."sesiones"
  drop constraint if exists "sesiones_modo_participacion_check";

alter table "public"."sesiones"
  add constraint "sesiones_modo_participacion_check"
  check ("modo_participacion" in ('anonimo', 'colaborador'));

alter table "public"."sesiones"
  drop constraint if exists "sesiones_modo_collaborator_consistency_check";

alter table "public"."sesiones"
  add constraint "sesiones_modo_collaborator_consistency_check"
  check (
    ("modo_participacion" = 'anonimo' and "collaborator_id" is null)
    or
    ("modo_participacion" = 'colaborador' and "collaborator_id" is not null)
  );

alter table "public"."sesiones"
  drop constraint if exists "sesiones_browser_session_token_key";

alter table "public"."sesiones"
  add constraint "sesiones_browser_session_token_key" unique ("browser_session_token");

-- ============================================
-- colaboradores: keep existing demographics, add extended profile data
-- ============================================

alter table "public"."colaboradores"
  add column if not exists "anio_nacimiento" smallint,
  add column if not exists "city_name" text,
  add column if not exists "city_geoname_id" bigint,
  add column if not exists "country_name" text,
  add column if not exists "country_geoname_id" bigint,
  add column if not exists "relacion_obra" text[],
  add column if not exists "consent_rgpd" boolean not null default false,
  add column if not exists "consent_rgpd_version" text,
  add column if not exists "consent_accepted_at" timestamp with time zone,
  add column if not exists "updated_at" timestamp with time zone not null default now();

alter table "public"."colaboradores"
  drop constraint if exists "colaboradores_anio_nacimiento_check";

alter table "public"."colaboradores"
  add constraint "colaboradores_anio_nacimiento_check"
  check (
    "anio_nacimiento" is null
    or "anio_nacimiento" between 1900 and extract(year from now())::smallint
  );

alter table "public"."colaboradores"
  drop constraint if exists "colaboradores_city_geoname_id_check";

alter table "public"."colaboradores"
  add constraint "colaboradores_city_geoname_id_check"
  check ("city_geoname_id" is null or "city_geoname_id" > 0);

alter table "public"."colaboradores"
  drop constraint if exists "colaboradores_country_geoname_id_check";

alter table "public"."colaboradores"
  add constraint "colaboradores_country_geoname_id_check"
  check ("country_geoname_id" is null or "country_geoname_id" > 0);

alter table "public"."colaboradores"
  drop constraint if exists "colaboradores_relacion_obra_catalog_check";

alter table "public"."colaboradores"
  add constraint "colaboradores_relacion_obra_catalog_check"
  check (
    "relacion_obra" is null
    or "relacion_obra" <@ array[
      'lectura',
      'espectador_teatro',
      'creacion_escenica',
      'docencia',
      'investigacion',
      'edicion_literaria'
    ]::text[]
  );

alter table "public"."colaboradores"
  drop constraint if exists "colaboradores_consent_rgpd_coherence_check";

alter table "public"."colaboradores"
  add constraint "colaboradores_consent_rgpd_coherence_check"
  check (
    ("consent_rgpd" = true and "consent_rgpd_version" is not null and "consent_accepted_at" is not null)
    or
    ("consent_rgpd" = false and "consent_rgpd_version" is null and "consent_accepted_at" is null)
  );

create index if not exists "idx_colaboradores_city_geoname_id"
  on "public"."colaboradores" using btree ("city_geoname_id");

create index if not exists "idx_colaboradores_country_geoname_id"
  on "public"."colaboradores" using btree ("country_geoname_id");

create index if not exists "idx_colaboradores_relacion_obra_gin"
  on "public"."colaboradores" using gin ("relacion_obra");

create or replace function "public"."set_updated_at"()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists "trg_colaboradores_set_updated_at" on "public"."colaboradores";

create trigger "trg_colaboradores_set_updated_at"
before update on "public"."colaboradores"
for each row
execute function "public"."set_updated_at"();

-- ============================================
-- rpc_create_session v2 (phase 1)
-- ============================================

create or replace function "public"."rpc_create_session"(
  "p_modo_participacion" text,
  "p_collaborator_id" uuid default null::uuid
) returns table(
  "session_id" uuid,
  "modo_participacion" text,
  "collaborator_id" uuid,
  "created_at" timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.sesiones%rowtype;
  v_modo text;
begin
  v_modo := trim(lower(coalesce(p_modo_participacion, '')));

  if v_modo not in ('anonimo', 'colaborador') then
    raise exception 'modo_participacion invalido: %', p_modo_participacion;
  end if;

  if v_modo = 'colaborador' and p_collaborator_id is null then
    raise exception 'collaborator_id es obligatorio para sesiones de colaborador';
  end if;

  if v_modo = 'anonimo' and p_collaborator_id is not null then
    raise exception 'collaborator_id debe ser null para sesiones anonimas';
  end if;

  insert into public.sesiones (
    session_id,
    collaborator_id,
    modo_participacion,
    browser_session_token,
    modal_lectura_post_first_shown,
    last_activity_at
  )
  values (
    gen_random_uuid(),
    p_collaborator_id,
    v_modo,
    gen_random_uuid(),
    false,
    now()
  )
  returning *
  into v_session;

  return query
  select
    v_session.session_id,
    v_session.modo_participacion,
    v_session.collaborator_id,
    v_session.created_at;
end;
$$;

alter function "public"."rpc_create_session"(text, uuid) owner to "postgres";

revoke all on function "public"."rpc_create_session"(text, uuid) from public;
grant all on function "public"."rpc_create_session"(text, uuid) to "anon";
grant all on function "public"."rpc_create_session"(text, uuid) to "authenticated";
grant all on function "public"."rpc_create_session"(text, uuid) to "service_role";
