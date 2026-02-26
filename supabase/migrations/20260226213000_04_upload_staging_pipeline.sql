-- ============================================
-- PHASE 7: upload staging pipeline
-- ============================================

create extension if not exists "pgcrypto";

-- ============================================
-- Upload staging table
-- ============================================

create table if not exists "public"."contribuciones_upload_staging" (
  "staging_id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "session_id" uuid not null,
  "collaborator_id" uuid,
  "status" text not null default 'issued',
  "expires_at" timestamp with time zone not null,
  "token_jti" uuid not null,
  "files" jsonb not null default '[]'::jsonb,
  "file_count" integer not null default 0,
  "total_bytes" bigint not null default 0,
  "last_error" text,
  "finalized_contribucion_id" uuid,
  "cleanup_attempts" integer not null default 0,
  constraint "contribuciones_upload_staging_session_id_fkey"
    foreign key ("session_id")
    references "public"."sesiones" ("session_id")
    on delete cascade,
  constraint "contribuciones_upload_staging_collaborator_id_fkey"
    foreign key ("collaborator_id")
    references "public"."colaboradores" ("collaborator_id")
    on delete set null,
  constraint "contribuciones_upload_staging_finalized_contribucion_id_fkey"
    foreign key ("finalized_contribucion_id")
    references "public"."contribuciones_archivo" ("contribucion_id")
    on delete set null,
  constraint "contribuciones_upload_staging_status_check"
    check (
      "status" in (
        'issued',
        'uploading',
        'uploaded',
        'finalized',
        'cancelled',
        'expired',
        'cleanup_failed'
      )
    ),
  constraint "contribuciones_upload_staging_files_array_check"
    check (jsonb_typeof("files") = 'array'),
  constraint "contribuciones_upload_staging_file_count_check"
    check ("file_count" >= 0),
  constraint "contribuciones_upload_staging_total_bytes_check"
    check ("total_bytes" >= 0),
  constraint "contribuciones_upload_staging_cleanup_attempts_check"
    check ("cleanup_attempts" >= 0),
  constraint "contribuciones_upload_staging_token_jti_unique"
    unique ("token_jti")
);

create index if not exists "idx_upload_staging_session_created_at"
  on "public"."contribuciones_upload_staging" using btree ("session_id", "created_at" desc);

create index if not exists "idx_upload_staging_status_expires_at"
  on "public"."contribuciones_upload_staging" using btree ("status", "expires_at");

create index if not exists "idx_upload_staging_finalized_contribucion_id"
  on "public"."contribuciones_upload_staging" using btree ("finalized_contribucion_id");

create unique index if not exists "idx_upload_staging_token_jti"
  on "public"."contribuciones_upload_staging" using btree ("token_jti");

drop trigger if exists "trg_contribuciones_upload_staging_set_updated_at" on "public"."contribuciones_upload_staging";

create trigger "trg_contribuciones_upload_staging_set_updated_at"
before update on "public"."contribuciones_upload_staging"
for each row
execute function "public"."set_updated_at"();

alter table "public"."contribuciones_upload_staging" enable row level security;
revoke all on table "public"."contribuciones_upload_staging" from "anon", "authenticated";

-- ============================================
-- RPC staged submit for contribuciones_archivo
-- ============================================

create or replace function "public"."rpc_submit_contribucion_archivo_staged"(
  "p_session_id" uuid,
  "p_staging_id" uuid,
  "p_titulo" text,
  "p_descripcion" text default null::text,
  "p_creadores" jsonb default null::jsonb,
  "p_fecha" date default null::date,
  "p_fecha_texto" text default null::text,
  "p_ciudad_nombre" text default null::text,
  "p_ciudad_geoname_id" bigint default null::bigint,
  "p_pais_nombre" text default null::text,
  "p_pais_geoname_id" bigint default null::bigint,
  "p_lugar_texto" text default null::text,
  "p_linked_archive_refs" text[] default null::text[],
  "p_rights_type" text default null::text,
  "p_rights_holder" text default null::text,
  "p_privacy_consent" boolean default null::boolean,
  "p_privacy_consent_version" text default null::text,
  "p_privacy_consent_at" timestamp with time zone default null::timestamp with time zone
)
returns table(
  "contribucion_id" uuid,
  "status" text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.sesiones%rowtype;
  v_staging public.contribuciones_upload_staging%rowtype;
  v_ip_hash text;
  v_drive_file_ids text[];
  v_new public.contribuciones_archivo%rowtype;
begin
  if p_session_id is null then
    raise exception 'session_id es obligatorio';
  end if;

  if p_staging_id is null then
    raise exception 'staging_id es obligatorio';
  end if;

  select *
    into v_session
    from public.sesiones s
   where s.session_id = p_session_id
   limit 1;

  if not found then
    raise exception 'session_id no encontrado';
  end if;

  select *
    into v_staging
    from public.contribuciones_upload_staging cus
   where cus.staging_id = p_staging_id
   for update;

  if not found then
    raise exception 'staging_id no encontrado';
  end if;

  if v_staging.session_id <> p_session_id then
    raise exception 'staging no pertenece a la sesion';
  end if;

  if v_staging.status <> 'uploaded' then
    raise exception 'staging no esta listo para envio';
  end if;

  if v_staging.expires_at <= now() then
    raise exception 'staging expirado';
  end if;

  if coalesce(v_staging.file_count, 0) < 1 then
    raise exception 'staging sin archivos';
  end if;

  select coalesce(array_agg(distinct x.drive_file_id), '{}'::text[])
    into v_drive_file_ids
    from (
      select nullif(trim(file_item ->> 'drive_file_id'), '') as drive_file_id
      from jsonb_array_elements(coalesce(v_staging.files, '[]'::jsonb)) as file_item
    ) x
    where x.drive_file_id is not null;

  if cardinality(v_drive_file_ids) < 1 then
    raise exception 'staging sin drive_file_id valido';
  end if;

  v_ip_hash := public._request_ip_hash();
  perform public._assert_rate_limit(
    'submit_contribucion',
    p_session_id,
    v_ip_hash,
    2,
    8,
    interval '24 hours'
  );

  insert into public.contribuciones_archivo (
    session_id,
    collaborator_id,
    titulo,
    descripcion,
    creadores,
    fecha,
    fecha_texto,
    ciudad_nombre,
    ciudad_geoname_id,
    pais_nombre,
    pais_geoname_id,
    lugar_texto,
    linked_archive_refs,
    rights_type,
    rights_holder,
    drive_file_ids,
    privacy_consent,
    privacy_consent_version,
    privacy_consent_at
  )
  values (
    p_session_id,
    v_session.collaborator_id,
    p_titulo,
    p_descripcion,
    coalesce(p_creadores, '[]'::jsonb),
    p_fecha,
    p_fecha_texto,
    p_ciudad_nombre,
    p_ciudad_geoname_id,
    p_pais_nombre,
    p_pais_geoname_id,
    p_lugar_texto,
    coalesce(p_linked_archive_refs, '{}'::text[]),
    p_rights_type,
    p_rights_holder,
    v_drive_file_ids,
    p_privacy_consent,
    p_privacy_consent_version,
    coalesce(p_privacy_consent_at, now())
  )
  returning *
  into v_new;

  update public.contribuciones_upload_staging
     set status = 'finalized',
         finalized_contribucion_id = v_new.contribucion_id,
         last_error = null,
         expires_at = greatest(expires_at, now() + interval '7 days')
   where staging_id = v_staging.staging_id;

  insert into public.participacion_rate_limit_events (
    action,
    session_id,
    ip_hash
  )
  values (
    'submit_contribucion',
    p_session_id,
    v_ip_hash
  );

  return query
  select
    v_new.contribucion_id,
    v_new.status;
end;
$$;

revoke all on function "public"."rpc_submit_contribucion_archivo_staged"(uuid, uuid, text, text, jsonb, date, text, text, bigint, text, bigint, text, text[], text, text, boolean, text, timestamp with time zone) from public;
grant execute on function "public"."rpc_submit_contribucion_archivo_staged"(uuid, uuid, text, text, jsonb, date, text, text, bigint, text, bigint, text, text[], text, text, boolean, text, timestamp with time zone) to "anon", "authenticated", "service_role";
