-- ============================================
-- PHASE 3: rpc v2 + rls/acl hardening + rate limit
-- ============================================

create extension if not exists "pgcrypto";

-- ============================================
-- ACL hardening (direct table access)
-- ============================================

revoke all on table "public"."sesiones" from "anon", "authenticated";
revoke all on table "public"."colaboradores" from "anon", "authenticated";
revoke all on table "public"."evaluaciones" from "anon", "authenticated";
revoke all on table "public"."testimonios" from "anon", "authenticated";
revoke all on table "public"."contribuciones_archivo" from "anon", "authenticated";
revoke all on table "public"."vinculos_testimonio_archivo" from "anon", "authenticated";

-- Hardening future defaults for objects created in schema public by postgres.
alter default privileges for role "postgres" in schema "public"
  revoke all on tables from "anon", "authenticated";

alter default privileges for role "postgres" in schema "public"
  revoke all on functions from "anon", "authenticated";

alter default privileges for role "postgres" in schema "public"
  revoke all on sequences from "anon", "authenticated";

-- ============================================
-- Rate limit events table
-- ============================================

create table if not exists "public"."participacion_rate_limit_events" (
  "id" bigserial primary key,
  "created_at" timestamp with time zone not null default now(),
  "action" text not null,
  "session_id" uuid not null,
  "ip_hash" text not null,
  constraint "participacion_rate_limit_events_action_check"
    check ("action" in ('submit_testimonio', 'submit_contribucion')),
  constraint "participacion_rate_limit_events_session_id_fkey"
    foreign key ("session_id")
    references "public"."sesiones" ("session_id")
    on delete cascade
);

create index if not exists "idx_prle_action_session_created_at"
  on "public"."participacion_rate_limit_events" using btree ("action", "session_id", "created_at");

create index if not exists "idx_prle_action_iphash_created_at"
  on "public"."participacion_rate_limit_events" using btree ("action", "ip_hash", "created_at");

alter table "public"."participacion_rate_limit_events" enable row level security;
revoke all on table "public"."participacion_rate_limit_events" from "anon", "authenticated";
revoke all on sequence "public"."participacion_rate_limit_events_id_seq" from "anon", "authenticated";

-- ============================================
-- Internal helpers (not exposed)
-- ============================================

create or replace function "public"."_request_ip_text"()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_headers_raw text;
  v_headers jsonb;
  v_forwarded text;
  v_ip text;
begin
  v_headers_raw := current_setting('request.headers', true);

  if v_headers_raw is not null and length(trim(v_headers_raw)) > 0 then
    begin
      v_headers := v_headers_raw::jsonb;
    exception
      when others then
        v_headers := '{}'::jsonb;
    end;

    v_forwarded := coalesce(
      nullif(trim(v_headers ->> 'x-forwarded-for'), ''),
      nullif(trim(v_headers ->> 'x-real-ip'), ''),
      nullif(trim(v_headers ->> 'cf-connecting-ip'), '')
    );

    if v_forwarded is not null then
      v_ip := trim(split_part(v_forwarded, ',', 1));
    end if;
  end if;

  if v_ip is null or length(v_ip) = 0 then
    v_ip := coalesce(inet_client_addr()::text, 'unknown');
  end if;

  return v_ip;
end;
$$;

create or replace function "public"."_request_ip_hash"()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ip text;
begin
  v_ip := lower(trim(coalesce(public._request_ip_text(), 'unknown')));
  return encode(extensions.digest(v_ip, 'sha256'), 'hex');
end;
$$;

create or replace function "public"."_assert_rate_limit"(
  "p_action" text,
  "p_session_id" uuid,
  "p_ip_hash" text,
  "p_session_limit" integer,
  "p_ip_limit" integer,
  "p_window" interval default interval '24 hours'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_count integer;
  v_ip_count integer;
begin
  select count(*)::integer
  into v_session_count
  from public.participacion_rate_limit_events e
  where e.action = p_action
    and e.session_id = p_session_id
    and e.created_at >= now() - p_window;

  if v_session_count >= p_session_limit then
    raise exception 'rate_limit_session_exceeded:%', p_action;
  end if;

  select count(*)::integer
  into v_ip_count
  from public.participacion_rate_limit_events e
  where e.action = p_action
    and e.ip_hash = p_ip_hash
    and e.created_at >= now() - p_window;

  if v_ip_count >= p_ip_limit then
    raise exception 'rate_limit_ip_exceeded:%', p_action;
  end if;
end;
$$;

revoke all on function "public"."_request_ip_text"() from public;
revoke all on function "public"."_request_ip_hash"() from public;
revoke all on function "public"."_assert_rate_limit"(text, uuid, text, integer, integer, interval) from public;

-- ============================================
-- RPC v2
-- ============================================

create or replace function "public"."rpc_bootstrap_session"(
  "p_browser_session_token" uuid default null::uuid
)
returns table(
  "session_id" uuid,
  "browser_session_token" uuid,
  "modo_participacion" text,
  "collaborator_id" uuid,
  "created_at" timestamp with time zone,
  "last_activity_at" timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.sesiones%rowtype;
  v_token uuid;
begin
  v_token := coalesce(p_browser_session_token, gen_random_uuid());

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
    null,
    'anonimo',
    v_token,
    false,
    now()
  )
  on conflict on constraint "sesiones_browser_session_token_key"
  do update
    set last_activity_at = now()
  returning *
  into v_session;

  return query
  select
    v_session.session_id,
    v_session.browser_session_token,
    v_session.modo_participacion,
    v_session.collaborator_id,
    v_session.created_at,
    v_session.last_activity_at;
end;
$$;

create or replace function "public"."rpc_set_mode_anonimo"(
  "p_session_id" uuid
)
returns table(
  "session_id" uuid,
  "browser_session_token" uuid,
  "modo_participacion" text,
  "collaborator_id" uuid,
  "created_at" timestamp with time zone,
  "last_activity_at" timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.sesiones%rowtype;
begin
  if p_session_id is null then
    raise exception 'session_id es obligatorio';
  end if;

  update public.sesiones s
     set modo_participacion = 'anonimo',
         collaborator_id = null,
         last_activity_at = now()
   where s.session_id = p_session_id
  returning *
    into v_session;

  if not found then
    raise exception 'session_id no encontrado';
  end if;

  return query
  select
    v_session.session_id,
    v_session.browser_session_token,
    v_session.modo_participacion,
    v_session.collaborator_id,
    v_session.created_at,
    v_session.last_activity_at;
end;
$$;

create or replace function "public"."rpc_collaborator_register_and_bind_session"(
  "p_session_id" uuid,
  "p_email_hash" text,
  "p_display_name" text default null::text,
  "p_nivel_estudios" text default null::text,
  "p_disciplina" text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email_hash text;
  v_existing public.colaboradores%rowtype;
  v_new public.colaboradores%rowtype;
  v_session public.sesiones%rowtype;
begin
  if p_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  v_email_hash := trim(lower(coalesce(p_email_hash, '')));
  if length(v_email_hash) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email_hash');
  end if;

  select *
    into v_existing
    from public.colaboradores c
   where c.email_hash = v_email_hash
   limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_exists',
      'collaborator', jsonb_build_object(
        'collaborator_id', v_existing.collaborator_id,
        'display_name', v_existing.display_name,
        'nivel_estudios', v_existing.nivel_estudios,
        'disciplina', v_existing.disciplina
      )
    );
  end if;

  insert into public.colaboradores (
    email_hash,
    display_name,
    nivel_estudios,
    disciplina
  )
  values (
    v_email_hash,
    nullif(trim(coalesce(p_display_name, '')), ''),
    nullif(trim(coalesce(p_nivel_estudios, '')), ''),
    nullif(trim(coalesce(p_disciplina, '')), '')
  )
  returning *
  into v_new;

  update public.sesiones s
     set modo_participacion = 'colaborador',
         collaborator_id = v_new.collaborator_id,
         last_activity_at = now()
   where s.session_id = p_session_id
  returning *
    into v_session;

  if not found then
    raise exception 'session_id no encontrado';
  end if;

  return jsonb_build_object(
    'ok', true,
    'reason', 'bound',
    'session', jsonb_build_object(
      'session_id', v_session.session_id,
      'modo_participacion', v_session.modo_participacion,
      'collaborator_id', v_session.collaborator_id,
      'browser_session_token', v_session.browser_session_token,
      'created_at', v_session.created_at,
      'last_activity_at', v_session.last_activity_at
    ),
    'collaborator', jsonb_build_object(
      'collaborator_id', v_new.collaborator_id,
      'display_name', v_new.display_name,
      'nivel_estudios', v_new.nivel_estudios,
      'disciplina', v_new.disciplina
    )
  );
end;
$$;

create or replace function "public"."rpc_collaborator_login_and_bind_session"(
  "p_session_id" uuid,
  "p_email_hash" text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email_hash text;
  v_collab public.colaboradores%rowtype;
  v_session public.sesiones%rowtype;
begin
  if p_session_id is null then
    return jsonb_build_object('ok', false, 'found', false, 'reason', 'invalid_session');
  end if;

  v_email_hash := trim(lower(coalesce(p_email_hash, '')));
  if length(v_email_hash) = 0 then
    return jsonb_build_object('ok', false, 'found', false, 'reason', 'invalid_email_hash');
  end if;

  select *
    into v_collab
    from public.colaboradores c
   where c.email_hash = v_email_hash
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'found', false, 'collaborator', null);
  end if;

  update public.sesiones s
     set modo_participacion = 'colaborador',
         collaborator_id = v_collab.collaborator_id,
         last_activity_at = now()
   where s.session_id = p_session_id
  returning *
    into v_session;

  if not found then
    raise exception 'session_id no encontrado';
  end if;

  return jsonb_build_object(
    'ok', true,
    'found', true,
    'session', jsonb_build_object(
      'session_id', v_session.session_id,
      'modo_participacion', v_session.modo_participacion,
      'collaborator_id', v_session.collaborator_id,
      'browser_session_token', v_session.browser_session_token,
      'created_at', v_session.created_at,
      'last_activity_at', v_session.last_activity_at
    ),
    'collaborator', jsonb_build_object(
      'collaborator_id', v_collab.collaborator_id,
      'display_name', v_collab.display_name,
      'nivel_estudios', v_collab.nivel_estudios,
      'disciplina', v_collab.disciplina
    )
  );
end;
$$;

create or replace function "public"."rpc_submit_testimonio"(
  "p_session_id" uuid,
  "p_titulo" text,
  "p_testimonio" text,
  "p_experiencia_fecha" date default null::date,
  "p_experiencia_fecha_texto" text default null::text,
  "p_experiencia_ciudad_nombre" text default null::text,
  "p_experiencia_ciudad_geoname_id" bigint default null::bigint,
  "p_experiencia_pais_nombre" text default null::text,
  "p_experiencia_pais_geoname_id" bigint default null::bigint,
  "p_experiencia_lugar_texto" text default null::text,
  "p_experiencia_contexto" text default null::text,
  "p_experiencia_rango_edad" text default null::text,
  "p_linked_archive_refs" text[] default null::text[],
  "p_privacy_settings" jsonb default null::jsonb,
  "p_privacy_consent" boolean default null::boolean,
  "p_privacy_consent_version" text default null::text,
  "p_privacy_consent_at" timestamp with time zone default null::timestamp with time zone
)
returns table(
  "testimonio_id" uuid,
  "status" text,
  "publicado" boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.sesiones%rowtype;
  v_ip_hash text;
  v_new public.testimonios%rowtype;
begin
  select *
    into v_session
    from public.sesiones s
   where s.session_id = p_session_id
   limit 1;

  if not found then
    raise exception 'session_id no encontrado';
  end if;

  v_ip_hash := public._request_ip_hash();
  perform public._assert_rate_limit(
    'submit_testimonio',
    p_session_id,
    v_ip_hash,
    3,
    10,
    interval '24 hours'
  );

  insert into public.testimonios (
    session_id,
    collaborator_id,
    titulo,
    testimonio,
    experiencia_fecha,
    experiencia_fecha_texto,
    experiencia_ciudad_nombre,
    experiencia_ciudad_geoname_id,
    experiencia_pais_nombre,
    experiencia_pais_geoname_id,
    experiencia_lugar_texto,
    experiencia_contexto,
    experiencia_rango_edad,
    linked_archive_refs,
    privacy_settings,
    privacy_consent,
    privacy_consent_version,
    privacy_consent_at
  )
  values (
    p_session_id,
    v_session.collaborator_id,
    p_titulo,
    p_testimonio,
    p_experiencia_fecha,
    p_experiencia_fecha_texto,
    p_experiencia_ciudad_nombre,
    p_experiencia_ciudad_geoname_id,
    p_experiencia_pais_nombre,
    p_experiencia_pais_geoname_id,
    p_experiencia_lugar_texto,
    p_experiencia_contexto,
    p_experiencia_rango_edad,
    coalesce(p_linked_archive_refs, '{}'::text[]),
    p_privacy_settings,
    p_privacy_consent,
    p_privacy_consent_version,
    coalesce(p_privacy_consent_at, now())
  )
  returning *
  into v_new;

  insert into public.participacion_rate_limit_events (
    action,
    session_id,
    ip_hash
  )
  values (
    'submit_testimonio',
    p_session_id,
    v_ip_hash
  );

  return query
  select
    v_new.testimonio_id,
    v_new.status,
    v_new.publicado;
end;
$$;

create or replace function "public"."rpc_submit_contribucion_archivo"(
  "p_session_id" uuid,
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
  "p_drive_file_ids" text[] default null::text[],
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
  v_ip_hash text;
  v_new public.contribuciones_archivo%rowtype;
begin
  select *
    into v_session
    from public.sesiones s
   where s.session_id = p_session_id
   limit 1;

  if not found then
    raise exception 'session_id no encontrado';
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
    coalesce(p_drive_file_ids, '{}'::text[]),
    p_privacy_consent,
    p_privacy_consent_version,
    coalesce(p_privacy_consent_at, now())
  )
  returning *
  into v_new;

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

create or replace function "public"."rpc_link_testimonio_contribucion"(
  "p_session_id" uuid,
  "p_testimonio_id" uuid,
  "p_contribucion_id" uuid,
  "p_declared_from" text
)
returns table(
  "vinculo_id" uuid
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session public.sesiones%rowtype;
  v_testimonio public.testimonios%rowtype;
  v_contribucion public.contribuciones_archivo%rowtype;
  v_vinculo_id uuid;
begin
  select *
    into v_session
    from public.sesiones s
   where s.session_id = p_session_id
   limit 1;

  if not found then
    raise exception 'session_id no encontrado';
  end if;

  select *
    into v_testimonio
    from public.testimonios t
   where t.testimonio_id = p_testimonio_id
   limit 1;

  if not found then
    raise exception 'testimonio_id no encontrado';
  end if;

  select *
    into v_contribucion
    from public.contribuciones_archivo c
   where c.contribucion_id = p_contribucion_id
   limit 1;

  if not found then
    raise exception 'contribucion_id no encontrado';
  end if;

  if not (
    (
      v_testimonio.session_id = p_session_id
      or (
        v_session.collaborator_id is not null
        and v_testimonio.collaborator_id = v_session.collaborator_id
      )
    )
    and
    (
      v_contribucion.session_id = p_session_id
      or (
        v_session.collaborator_id is not null
        and v_contribucion.collaborator_id = v_session.collaborator_id
      )
    )
  ) then
    raise exception 'no autorizado para vincular estos registros';
  end if;

  insert into public.vinculos_testimonio_archivo as vta (
    testimonio_id,
    contribucion_id,
    declared_from
  )
  values (
    p_testimonio_id,
    p_contribucion_id,
    p_declared_from
  )
  on conflict (testimonio_id, contribucion_id)
  do update set declared_from = excluded.declared_from
  returning vta.vinculo_id
  into v_vinculo_id;

  return query
  select v_vinculo_id;
end;
$$;

create or replace function "public"."rpc_list_testimonios_publicos"(
  "p_limit" integer default 20,
  "p_offset" integer default 0
)
returns table(
  "testimonio_id" uuid,
  "created_at" timestamp with time zone,
  "titulo" text,
  "testimonio" text,
  "experiencia_fecha" date,
  "experiencia_fecha_texto" text,
  "experiencia_ciudad_nombre" text,
  "experiencia_pais_nombre" text,
  "experiencia_lugar_texto" text,
  "experiencia_contexto" text,
  "experiencia_rango_edad" text,
  "display_name" text,
  "linked_archive_refs" text[]
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_limit integer;
  v_offset integer;
begin
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  select
    t.testimonio_id,
    t.created_at,
    t.titulo,
    t.testimonio,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_fecha')::boolean, false) then t.experiencia_fecha
      else null
    end as experiencia_fecha,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_fecha')::boolean, false) then t.experiencia_fecha_texto
      else null
    end as experiencia_fecha_texto,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_ciudad')::boolean, false) then t.experiencia_ciudad_nombre
      else null
    end as experiencia_ciudad_nombre,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_pais')::boolean, false) then t.experiencia_pais_nombre
      else null
    end as experiencia_pais_nombre,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_lugar_texto')::boolean, false) then t.experiencia_lugar_texto
      else null
    end as experiencia_lugar_texto,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_contexto')::boolean, false) then t.experiencia_contexto
      else null
    end as experiencia_contexto,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_rango_edad')::boolean, false) then t.experiencia_rango_edad
      else null
    end as experiencia_rango_edad,
    case
      when coalesce((t.privacy_settings ->> 'mostrar_nombre')::boolean, false) then c.display_name
      else null
    end as display_name,
    t.linked_archive_refs
  from public.testimonios t
  left join public.colaboradores c
    on c.collaborator_id = t.collaborator_id
  where t.status = 'aprobado'
    and t.publicado = true
  order by t.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

-- ============================================
-- Grants for public RPCs
-- ============================================

revoke all on function "public"."rpc_bootstrap_session"(uuid) from public;
grant execute on function "public"."rpc_bootstrap_session"(uuid) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_set_mode_anonimo"(uuid) from public;
grant execute on function "public"."rpc_set_mode_anonimo"(uuid) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_collaborator_register_and_bind_session"(uuid, text, text, text, text) from public;
grant execute on function "public"."rpc_collaborator_register_and_bind_session"(uuid, text, text, text, text) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_collaborator_login_and_bind_session"(uuid, text) from public;
grant execute on function "public"."rpc_collaborator_login_and_bind_session"(uuid, text) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_submit_testimonio"(uuid, text, text, date, text, text, bigint, text, bigint, text, text, text, text[], jsonb, boolean, text, timestamp with time zone) from public;
grant execute on function "public"."rpc_submit_testimonio"(uuid, text, text, date, text, text, bigint, text, bigint, text, text, text, text[], jsonb, boolean, text, timestamp with time zone) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_submit_contribucion_archivo"(uuid, text, text, jsonb, date, text, text, bigint, text, bigint, text, text[], text, text, text[], boolean, text, timestamp with time zone) from public;
grant execute on function "public"."rpc_submit_contribucion_archivo"(uuid, text, text, jsonb, date, text, text, bigint, text, bigint, text, text[], text, text, text[], boolean, text, timestamp with time zone) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_link_testimonio_contribucion"(uuid, uuid, uuid, text) from public;
grant execute on function "public"."rpc_link_testimonio_contribucion"(uuid, uuid, uuid, text) to "anon", "authenticated", "service_role";

revoke all on function "public"."rpc_list_testimonios_publicos"(integer, integer) from public;
grant execute on function "public"."rpc_list_testimonios_publicos"(integer, integer) to "anon", "authenticated", "service_role";
