


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."_assert_rate_limit"("p_action" "text", "p_session_id" "uuid", "p_ip_hash" "text", "p_session_limit" integer, "p_ip_limit" integer, "p_window" interval DEFAULT '24:00:00'::interval) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."_assert_rate_limit"("p_action" "text", "p_session_id" "uuid", "p_ip_hash" "text", "p_session_limit" integer, "p_ip_limit" integer, "p_window" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_request_ip_hash"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ip text;
begin
  v_ip := lower(trim(coalesce(public._request_ip_text(), 'unknown')));
  return encode(extensions.digest(v_ip, 'sha256'), 'hex');
end;
$$;


ALTER FUNCTION "public"."_request_ip_hash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_request_ip_text"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."_request_ip_text"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_bootstrap_session"("p_browser_session_token" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("session_id" "uuid", "browser_session_token" "uuid", "modo_participacion" "text", "collaborator_id" "uuid", "created_at" timestamp with time zone, "last_activity_at" timestamp with time zone, "collaborator_created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  on conflict on constraint sesiones_browser_session_token_key
  do update
    set browser_session_token = excluded.browser_session_token
  returning *
  into v_session;

  return query
  select
    v_session.session_id,
    v_session.browser_session_token,
    v_session.modo_participacion,
    v_session.collaborator_id,
    v_session.created_at,
    v_session.last_activity_at,
    (
      select c.created_at
      from public.colaboradores c
      where c.collaborator_id = v_session.collaborator_id
    ) as collaborator_created_at;
end;
$$;


ALTER FUNCTION "public"."rpc_bootstrap_session"("p_browser_session_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") RETURNS TABLE("collaborator_id" "uuid", "display_name" "text", "nivel_estudios" "text", "disciplina" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_email_hash is null or length(trim(p_email_hash)) = 0 then
    return;
  end if;

  return query
  select
    c.collaborator_id,
    c.display_name,
    c.nivel_estudios,
    c.disciplina
  from public.colaboradores c
  where c.email_hash = trim(lower(p_email_hash))
  limit 1;
end;
$$;


ALTER FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_collaborator_login_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
         collaborator_id = v_collab.collaborator_id
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
      'disciplina', v_collab.disciplina,
      'created_at', v_collab.created_at
    )
  );
end;
$$;


ALTER FUNCTION "public"."rpc_collaborator_login_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text" DEFAULT NULL::"text", "p_nivel_estudios" "text" DEFAULT NULL::"text", "p_disciplina" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing public.colaboradores%rowtype;
  v_new public.colaboradores%rowtype;
  v_email_hash text;
begin
  v_email_hash := trim(lower(coalesce(p_email_hash, '')));

  if length(v_email_hash) = 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_email_hash'
    );
  end if;

  select *
  into v_existing
  from public.colaboradores
  where email_hash = v_email_hash
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

  return jsonb_build_object(
    'ok', true,
    'reason', 'created',
    'collaborator', jsonb_build_object(
      'collaborator_id', v_new.collaborator_id,
      'display_name', v_new.display_name,
      'nivel_estudios', v_new.nivel_estudios,
      'disciplina', v_new.disciplina
    )
  );
end;
$$;


ALTER FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_collaborator_register_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text", "p_display_name" "text" DEFAULT NULL::"text", "p_nivel_estudios" "text" DEFAULT NULL::"text", "p_disciplina" "text" DEFAULT NULL::"text", "p_anio_nacimiento" integer DEFAULT NULL::integer, "p_city_name" "text" DEFAULT NULL::"text", "p_city_geoname_id" bigint DEFAULT NULL::bigint, "p_country_name" "text" DEFAULT NULL::"text", "p_country_geoname_id" bigint DEFAULT NULL::bigint, "p_relacion_obra" "text"[] DEFAULT NULL::"text"[], "p_consent_rgpd" boolean DEFAULT false, "p_consent_rgpd_version" "text" DEFAULT NULL::"text", "p_consent_accepted_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email_hash text;
  v_existing public.colaboradores%rowtype;
  v_new public.colaboradores%rowtype;
  v_session public.sesiones%rowtype;
  v_consent_version text;
  v_consent_accepted_at timestamp with time zone;
  v_anio_nacimiento smallint;
  v_city_name text;
  v_country_name text;
  v_relacion_obra text[];
  v_relacion_obra_allowed text[] := array[
    'lectura',
    'espectador_teatro',
    'creacion_escenica',
    'docencia',
    'investigacion',
    'edicion_literaria'
  ]::text[];
begin
  if p_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  v_email_hash := trim(lower(coalesce(p_email_hash, '')));
  if length(v_email_hash) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email_hash');
  end if;

  if p_consent_rgpd is distinct from true then
    return jsonb_build_object('ok', false, 'reason', 'missing_consent_rgpd');
  end if;

  v_consent_version := trim(coalesce(p_consent_rgpd_version, ''));
  if length(v_consent_version) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_consent_version');
  end if;

  v_consent_accepted_at := coalesce(p_consent_accepted_at, now());

  if p_anio_nacimiento is not null then
    if p_anio_nacimiento < 1900 or p_anio_nacimiento > extract(year from now())::integer then
      return jsonb_build_object('ok', false, 'reason', 'invalid_anio_nacimiento');
    end if;
    v_anio_nacimiento := p_anio_nacimiento::smallint;
  else
    v_anio_nacimiento := null;
  end if;

  v_city_name := nullif(trim(coalesce(p_city_name, '')), '');
  v_country_name := nullif(trim(coalesce(p_country_name, '')), '');

  if (v_city_name is null and p_city_geoname_id is null and v_country_name is null and p_country_geoname_id is null) then
    null;
  else
    if v_city_name is null
      or p_city_geoname_id is null
      or v_country_name is null
      or p_country_geoname_id is null
      or p_city_geoname_id <= 0
      or p_country_geoname_id <= 0
    then
      return jsonb_build_object('ok', false, 'reason', 'invalid_location_profile');
    end if;
  end if;

  if p_relacion_obra is not null then
    select array_agg(distinct item_norm) filter (where item_norm is not null)
      into v_relacion_obra
      from (
        select nullif(trim(lower(item_raw)), '') as item_norm
          from unnest(p_relacion_obra) as items(item_raw)
      ) normalized_items;

    if coalesce(array_length(v_relacion_obra, 1), 0) = 0 then
      v_relacion_obra := null;
    elsif not (v_relacion_obra <@ v_relacion_obra_allowed) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_relacion_obra');
    end if;
  else
    v_relacion_obra := null;
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
        'disciplina', v_existing.disciplina,
        'anio_nacimiento', v_existing.anio_nacimiento,
        'city_name', v_existing.city_name,
        'city_geoname_id', v_existing.city_geoname_id,
        'country_name', v_existing.country_name,
        'country_geoname_id', v_existing.country_geoname_id,
        'relacion_obra', v_existing.relacion_obra,
        'created_at', v_existing.created_at
      )
    );
  end if;

  insert into public.colaboradores (
    email_hash,
    display_name,
    nivel_estudios,
    disciplina,
    anio_nacimiento,
    city_name,
    city_geoname_id,
    country_name,
    country_geoname_id,
    relacion_obra,
    consent_rgpd,
    consent_rgpd_version,
    consent_accepted_at
  )
  values (
    v_email_hash,
    nullif(trim(coalesce(p_display_name, '')), ''),
    nullif(trim(coalesce(p_nivel_estudios, '')), ''),
    nullif(trim(coalesce(p_disciplina, '')), ''),
    v_anio_nacimiento,
    v_city_name,
    p_city_geoname_id,
    v_country_name,
    p_country_geoname_id,
    v_relacion_obra,
    true,
    v_consent_version,
    v_consent_accepted_at
  )
  returning *
  into v_new;

  update public.sesiones s
     set modo_participacion = 'colaborador',
         collaborator_id = v_new.collaborator_id
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
      'disciplina', v_new.disciplina,
      'anio_nacimiento', v_new.anio_nacimiento,
      'city_name', v_new.city_name,
      'city_geoname_id', v_new.city_geoname_id,
      'country_name', v_new.country_name,
      'country_geoname_id', v_new.country_geoname_id,
      'relacion_obra', v_new.relacion_obra,
      'created_at', v_new.created_at
    )
  );
end;
$$;


ALTER FUNCTION "public"."rpc_collaborator_register_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text", "p_anio_nacimiento" integer, "p_city_name" "text", "p_city_geoname_id" bigint, "p_country_name" "text", "p_country_geoname_id" bigint, "p_relacion_obra" "text"[], "p_consent_rgpd" boolean, "p_consent_rgpd_version" "text", "p_consent_accepted_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_create_session"("p_modo_participacion" "text", "p_collaborator_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("session_id" "uuid", "modo_participacion" "text", "collaborator_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_create_session"("p_modo_participacion" "text", "p_collaborator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_global_stats"() RETURNS TABLE("total_evaluaciones" bigint, "utiles" bigint, "mejorables" bigint, "total_sugerencias" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with evals as (
    select vote
    from public.evaluaciones
    where event_type = 'nota_eval'
  ),
  sugs as (
    select 1
    from public.evaluaciones
    where event_type = 'falta_nota'
  )
  select
    (select count(*)::bigint from evals) as total_evaluaciones,
    (select count(*)::bigint from evals where vote = 'up') as utiles,
    (select count(*)::bigint from evals where vote = 'down') as mejorables,
    (select count(*)::bigint from sugs) as total_sugerencias;
$$;


ALTER FUNCTION "public"."rpc_get_global_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_note_eval_counts"() RETURNS TABLE("nota_id" "text", "nota_change" "text", "total" bigint, "utiles" bigint, "mejorables" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_get_note_eval_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") RETURNS TABLE("nota_id" "text", "nota_change" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select distinct e.nota_id, e.nota_change
  from public.evaluaciones e
  where e.session_id = p_session_id
    and e.nota_id is not null
    and e.nota_change is not null;
$$;


ALTER FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") RETURNS TABLE("total_contribuciones" bigint, "total_evaluaciones" bigint, "votos_up" bigint, "votos_down" bigint, "comentarios" bigint, "total_sugerencias" bigint, "total_testimonios" bigint, "total_contribuciones_archivo" bigint, "total_envios" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_link_testimonio_contribucion"("p_session_id" "uuid", "p_testimonio_id" "uuid", "p_contribucion_id" "uuid", "p_declared_from" "text") RETURNS TABLE("vinculo_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_link_testimonio_contribucion"("p_session_id" "uuid", "p_testimonio_id" "uuid", "p_contribucion_id" "uuid", "p_declared_from" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_list_testimonios_publicos"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("testimonio_id" "uuid", "created_at" timestamp with time zone, "titulo" "text", "testimonio" "text", "experiencia_fecha" "date", "experiencia_fecha_texto" "text", "experiencia_ciudad_nombre" "text", "experiencia_pais_nombre" "text", "experiencia_lugar_texto" "text", "experiencia_contexto" "text", "experiencia_rango_edad" "text", "display_name" "text", "linked_archive_refs" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    and t.exported_at is not null
  order by t.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;


ALTER FUNCTION "public"."rpc_list_testimonios_publicos"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_set_mode_anonimo"("p_session_id" "uuid") RETURNS TABLE("session_id" "uuid", "browser_session_token" "uuid", "modo_participacion" "text", "collaborator_id" "uuid", "created_at" timestamp with time zone, "last_activity_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session public.sesiones%rowtype;
begin
  if p_session_id is null then
    raise exception 'session_id es obligatorio';
  end if;

  update public.sesiones s
     set modo_participacion = 'anonimo',
         collaborator_id = null
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


ALTER FUNCTION "public"."rpc_set_mode_anonimo"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_contribucion_archivo"("p_session_id" "uuid", "p_titulo" "text", "p_descripcion" "text" DEFAULT NULL::"text", "p_creadores" "jsonb" DEFAULT NULL::"jsonb", "p_fecha" "date" DEFAULT NULL::"date", "p_fecha_texto" "text" DEFAULT NULL::"text", "p_ciudad_nombre" "text" DEFAULT NULL::"text", "p_ciudad_geoname_id" bigint DEFAULT NULL::bigint, "p_pais_nombre" "text" DEFAULT NULL::"text", "p_pais_geoname_id" bigint DEFAULT NULL::bigint, "p_lugar_texto" "text" DEFAULT NULL::"text", "p_linked_archive_refs" "text"[] DEFAULT NULL::"text"[], "p_rights_type" "text" DEFAULT NULL::"text", "p_rights_holder" "text" DEFAULT NULL::"text", "p_drive_file_ids" "text"[] DEFAULT NULL::"text"[], "p_privacy_consent" boolean DEFAULT NULL::boolean, "p_privacy_consent_version" "text" DEFAULT NULL::"text", "p_privacy_consent_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("contribucion_id" "uuid", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_submit_contribucion_archivo"("p_session_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_drive_file_ids" "text"[], "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_contribucion_archivo_staged"("p_session_id" "uuid", "p_staging_id" "uuid", "p_titulo" "text", "p_descripcion" "text" DEFAULT NULL::"text", "p_creadores" "jsonb" DEFAULT NULL::"jsonb", "p_fecha" "date" DEFAULT NULL::"date", "p_fecha_texto" "text" DEFAULT NULL::"text", "p_ciudad_nombre" "text" DEFAULT NULL::"text", "p_ciudad_geoname_id" bigint DEFAULT NULL::bigint, "p_pais_nombre" "text" DEFAULT NULL::"text", "p_pais_geoname_id" bigint DEFAULT NULL::bigint, "p_lugar_texto" "text" DEFAULT NULL::"text", "p_linked_archive_refs" "text"[] DEFAULT NULL::"text"[], "p_rights_type" "text" DEFAULT NULL::"text", "p_rights_holder" "text" DEFAULT NULL::"text", "p_privacy_consent" boolean DEFAULT NULL::boolean, "p_privacy_consent_version" "text" DEFAULT NULL::"text", "p_privacy_consent_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("contribucion_id" "uuid", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_submit_contribucion_archivo_staged"("p_session_id" "uuid", "p_staging_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer DEFAULT NULL::integer, "p_nota_id" "text" DEFAULT NULL::"text", "p_nota_change" "text" DEFAULT NULL::"text", "p_target_xmlid" "text" DEFAULT NULL::"text", "p_vote" "text" DEFAULT NULL::"text", "p_selected_text" "text" DEFAULT NULL::"text", "p_comment" "text" DEFAULT NULL::"text") RETURNS TABLE("id" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_change" "text", "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_testimonio"("p_session_id" "uuid", "p_titulo" "text", "p_testimonio" "text", "p_experiencia_fecha" "date" DEFAULT NULL::"date", "p_experiencia_fecha_texto" "text" DEFAULT NULL::"text", "p_experiencia_ciudad_nombre" "text" DEFAULT NULL::"text", "p_experiencia_ciudad_geoname_id" bigint DEFAULT NULL::bigint, "p_experiencia_pais_nombre" "text" DEFAULT NULL::"text", "p_experiencia_pais_geoname_id" bigint DEFAULT NULL::bigint, "p_experiencia_lugar_texto" "text" DEFAULT NULL::"text", "p_experiencia_contexto" "text" DEFAULT NULL::"text", "p_experiencia_rango_edad" "text" DEFAULT NULL::"text", "p_linked_archive_refs" "text"[] DEFAULT NULL::"text"[], "p_privacy_settings" "jsonb" DEFAULT NULL::"jsonb", "p_privacy_consent" boolean DEFAULT NULL::boolean, "p_privacy_consent_version" "text" DEFAULT NULL::"text", "p_privacy_consent_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("testimonio_id" "uuid", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    v_new.status;
end;
$$;


ALTER FUNCTION "public"."rpc_submit_testimonio"("p_session_id" "uuid", "p_titulo" "text", "p_testimonio" "text", "p_experiencia_fecha" "date", "p_experiencia_fecha_texto" "text", "p_experiencia_ciudad_nombre" "text", "p_experiencia_ciudad_geoname_id" bigint, "p_experiencia_pais_nombre" "text", "p_experiencia_pais_geoname_id" bigint, "p_experiencia_lugar_texto" "text", "p_experiencia_contexto" "text", "p_experiencia_rango_edad" "text", "p_linked_archive_refs" "text"[], "p_privacy_settings" "jsonb", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_track_participacion_funnel_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text" DEFAULT 'lectura'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_track_participacion_funnel_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_track_participacion_pilot_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text" DEFAULT 'formulario'::"text", "p_nota_id" "text" DEFAULT NULL::"text", "p_nota_change" "text" DEFAULT NULL::"text", "p_pasaje_id" integer DEFAULT NULL::integer, "p_form_name" "text" DEFAULT NULL::"text", "p_field_name" "text" DEFAULT NULL::"text", "p_event_key" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."rpc_track_participacion_pilot_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_nota_id" "text", "p_nota_change" "text", "p_pasaje_id" integer, "p_form_name" "text", "p_field_name" "text", "p_event_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_session_last_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.session_id is not null then
    update public.sesiones s
       set last_activity_at = now()
     where s.session_id = new.session_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_session_last_activity"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."colaboradores" (
    "collaborator_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_hash" "text" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nivel_estudios" "text",
    "disciplina" "text",
    "anio_nacimiento" smallint,
    "city_name" "text",
    "city_geoname_id" bigint,
    "country_name" "text",
    "country_geoname_id" bigint,
    "relacion_obra" "text"[],
    "consent_rgpd" boolean DEFAULT false NOT NULL,
    "consent_rgpd_version" "text",
    "consent_accepted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "colaboradores_anio_nacimiento_check" CHECK ((("anio_nacimiento" IS NULL) OR (("anio_nacimiento" >= 1900) AND ("anio_nacimiento" <= (EXTRACT(year FROM "now"()))::smallint)))),
    CONSTRAINT "colaboradores_city_geoname_id_check" CHECK ((("city_geoname_id" IS NULL) OR ("city_geoname_id" > 0))),
    CONSTRAINT "colaboradores_consent_rgpd_coherence_check" CHECK (((("consent_rgpd" = true) AND ("consent_rgpd_version" IS NOT NULL) AND ("consent_accepted_at" IS NOT NULL)) OR (("consent_rgpd" = false) AND ("consent_rgpd_version" IS NULL) AND ("consent_accepted_at" IS NULL)))),
    CONSTRAINT "colaboradores_country_geoname_id_check" CHECK ((("country_geoname_id" IS NULL) OR ("country_geoname_id" > 0))),
    CONSTRAINT "colaboradores_relacion_obra_catalog_check" CHECK ((("relacion_obra" IS NULL) OR ("relacion_obra" <@ ARRAY['lectura'::"text", 'espectador_teatro'::"text", 'creacion_escenica'::"text", 'docencia'::"text", 'investigacion'::"text", 'edicion_literaria'::"text"])))
);


ALTER TABLE "public"."colaboradores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contribuciones_archivo" (
    "contribucion_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "collaborator_id" "uuid",
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "creadores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "fecha" "date",
    "fecha_texto" "text",
    "ciudad_nombre" "text",
    "ciudad_geoname_id" bigint,
    "pais_nombre" "text",
    "pais_geoname_id" bigint,
    "lugar_texto" "text",
    "linked_archive_refs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "rights_type" "text",
    "rights_holder" "text",
    "drive_file_ids" "text"[] NOT NULL,
    "status" "text" DEFAULT 'nuevo'::"text" NOT NULL,
    "collectionbuilder_id" "text",
    "privacy_consent" boolean NOT NULL,
    "privacy_consent_version" "text" NOT NULL,
    "privacy_consent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contribuciones_archivo_ciudad_geoname_id_check" CHECK ((("ciudad_geoname_id" IS NULL) OR ("ciudad_geoname_id" > 0))),
    CONSTRAINT "contribuciones_archivo_creadores_is_array_check" CHECK (("jsonb_typeof"("creadores") = 'array'::"text")),
    CONSTRAINT "contribuciones_archivo_drive_file_ids_check" CHECK (("array_position"("drive_file_ids", ''::"text") IS NULL)),
    CONSTRAINT "contribuciones_archivo_linked_archive_refs_no_empty_check" CHECK (("array_position"("linked_archive_refs", ''::"text") IS NULL)),
    CONSTRAINT "contribuciones_archivo_lugar_geonames_check" CHECK ((((NULLIF(TRIM(BOTH FROM COALESCE("ciudad_nombre", ''::"text")), ''::"text") IS NULL) AND ("ciudad_geoname_id" IS NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("pais_nombre", ''::"text")), ''::"text") IS NULL) AND ("pais_geoname_id" IS NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("lugar_texto", ''::"text")), ''::"text") IS NULL)) OR ((NULLIF(TRIM(BOTH FROM COALESCE("ciudad_nombre", ''::"text")), ''::"text") IS NOT NULL) AND ("ciudad_geoname_id" IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("pais_nombre", ''::"text")), ''::"text") IS NOT NULL) AND ("pais_geoname_id" IS NOT NULL)))),
    CONSTRAINT "contribuciones_archivo_pais_geoname_id_check" CHECK ((("pais_geoname_id" IS NULL) OR ("pais_geoname_id" > 0))),
    CONSTRAINT "contribuciones_archivo_privacy_consent_check" CHECK ((("privacy_consent" = true) AND ("length"(TRIM(BOTH FROM COALESCE("privacy_consent_version", ''::"text"))) > 0))),
    CONSTRAINT "contribuciones_archivo_rights_conditional_check" CHECK (((("cardinality"("drive_file_ids") = 0) AND ("rights_type" IS NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("rights_holder", ''::"text")), ''::"text") IS NULL)) OR (("cardinality"("drive_file_ids") >= 1) AND ("rights_type" = ANY (ARRAY['cc_by_nc_sa'::"text", 'copyright'::"text"])) AND ((("rights_type" = 'copyright'::"text") AND ("length"(TRIM(BOTH FROM COALESCE("rights_holder", ''::"text"))) > 0)) OR (("rights_type" = 'cc_by_nc_sa'::"text") AND ("rights_holder" IS NULL)))))),
    CONSTRAINT "contribuciones_archivo_status_check" CHECK (("status" = ANY (ARRAY['nuevo'::"text", 'aprobado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "contribuciones_archivo_titulo_not_blank_check" CHECK (("length"(TRIM(BOTH FROM COALESCE("titulo", ''::"text"))) > 0))
);


ALTER TABLE "public"."contribuciones_archivo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contribuciones_upload_staging" (
    "staging_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "collaborator_id" "uuid",
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "token_jti" "uuid" NOT NULL,
    "files" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "file_count" integer DEFAULT 0 NOT NULL,
    "total_bytes" bigint DEFAULT 0 NOT NULL,
    "last_error" "text",
    "finalized_contribucion_id" "uuid",
    "cleanup_attempts" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "contribuciones_upload_staging_cleanup_attempts_check" CHECK (("cleanup_attempts" >= 0)),
    CONSTRAINT "contribuciones_upload_staging_file_count_check" CHECK (("file_count" >= 0)),
    CONSTRAINT "contribuciones_upload_staging_files_array_check" CHECK (("jsonb_typeof"("files") = 'array'::"text")),
    CONSTRAINT "contribuciones_upload_staging_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'uploading'::"text", 'uploaded'::"text", 'finalized'::"text", 'cancelled'::"text", 'expired'::"text", 'cleanup_failed'::"text"]))),
    CONSTRAINT "contribuciones_upload_staging_total_bytes_check" CHECK (("total_bytes" >= 0))
);


ALTER TABLE "public"."contribuciones_upload_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluaciones" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "pasaje_id" integer,
    "nota_id" "text",
    "nota_change" "text",
    "target_xmlid" "text",
    "vote" "text",
    "comment" "text",
    "selected_text" "text",
    CONSTRAINT "evaluaciones_event_type_check" CHECK (("event_type" = ANY (ARRAY['nota_eval'::"text", 'falta_nota'::"text"]))),
    CONSTRAINT "evaluaciones_source_check" CHECK (("source" = ANY (ARRAY['lectura'::"text", 'laboratorio'::"text"]))),
    CONSTRAINT "evaluaciones_vote_check" CHECK (("vote" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."evaluaciones" OWNER TO "postgres";


COMMENT ON COLUMN "public"."evaluaciones"."pasaje_id" IS 'Identificador local estable del pasaje derivado del XML base. No referencia una tabla catálogo.';



COMMENT ON COLUMN "public"."evaluaciones"."selected_text" IS 'Texto seleccionado por el usuario cuando sugiere que falta una nota. Null para event_type=nota_eval';



CREATE SEQUENCE IF NOT EXISTS "public"."evaluaciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evaluaciones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evaluaciones_id_seq" OWNED BY "public"."evaluaciones"."id";



CREATE TABLE IF NOT EXISTS "public"."participacion_funnel_events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "context" "text" DEFAULT 'lectura'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "participacion_funnel_events_event_name_check" CHECK (("event_name" = ANY (ARRAY['lectura_first_contribution'::"text", 'lectura_second_prompt_opened'::"text", 'lectura_second_prompt_choice_anonimo'::"text", 'lectura_second_prompt_choice_colaborador'::"text", 'lectura_second_prompt_abandoned'::"text"])))
);


ALTER TABLE "public"."participacion_funnel_events" OWNER TO "postgres";


ALTER TABLE "public"."participacion_funnel_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."participacion_funnel_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."participacion_pilot_events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "context" "text" NOT NULL,
    "nota_id" "text",
    "nota_change" "text",
    "pasaje_id" integer,
    "form_name" "text",
    "field_name" "text",
    "event_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "participacion_pilot_events_context_check" CHECK (("context" = ANY (ARRAY['lectura'::"text", 'laboratorio'::"text", 'formulario'::"text"]))),
    CONSTRAINT "participacion_pilot_events_event_name_check" CHECK (("event_name" = ANY (ARRAY['note_unrated_view'::"text", 'lab_passage_skipped'::"text", 'form_started'::"text", 'form_submitted'::"text", 'form_abandoned'::"text"])))
);


ALTER TABLE "public"."participacion_pilot_events" OWNER TO "postgres";


ALTER TABLE "public"."participacion_pilot_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."participacion_pilot_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."participacion_pilot_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "participacion_pilot_settings_singleton_check" CHECK (("id" = true))
);


ALTER TABLE "public"."participacion_pilot_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participacion_rate_limit_events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "ip_hash" "text" NOT NULL,
    CONSTRAINT "participacion_rate_limit_events_action_check" CHECK (("action" = ANY (ARRAY['submit_testimonio'::"text", 'submit_contribucion'::"text", 'submit_evaluacion'::"text"])))
);


ALTER TABLE "public"."participacion_rate_limit_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."participacion_rate_limit_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."participacion_rate_limit_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."participacion_rate_limit_events_id_seq" OWNED BY "public"."participacion_rate_limit_events"."id";



CREATE TABLE IF NOT EXISTS "public"."proyecto_activo" (
    "id" integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'activo'::"text"
);


ALTER TABLE "public"."proyecto_activo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."proyecto_activo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."proyecto_activo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."proyecto_activo_id_seq" OWNED BY "public"."proyecto_activo"."id";



CREATE TABLE IF NOT EXISTS "public"."sesiones" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "collaborator_id" "uuid",
    "modo_participacion" "text" NOT NULL,
    "browser_session_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modal_lectura_post_first_shown" boolean DEFAULT false NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sesiones_modo_collaborator_consistency_check" CHECK (((("modo_participacion" = 'anonimo'::"text") AND ("collaborator_id" IS NULL)) OR (("modo_participacion" = 'colaborador'::"text") AND ("collaborator_id" IS NOT NULL)))),
    CONSTRAINT "sesiones_modo_participacion_check" CHECK (("modo_participacion" = ANY (ARRAY['anonimo'::"text", 'colaborador'::"text"])))
);


ALTER TABLE "public"."sesiones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonios" (
    "testimonio_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "collaborator_id" "uuid",
    "titulo" "text" NOT NULL,
    "testimonio" "text" NOT NULL,
    "experiencia_fecha" "date",
    "experiencia_fecha_texto" "text",
    "experiencia_ciudad_nombre" "text",
    "experiencia_ciudad_geoname_id" bigint,
    "experiencia_pais_nombre" "text",
    "experiencia_pais_geoname_id" bigint,
    "experiencia_lugar_texto" "text",
    "experiencia_contexto" "text",
    "experiencia_rango_edad" "text",
    "linked_archive_refs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "privacy_settings" "jsonb" NOT NULL,
    "privacy_consent" boolean NOT NULL,
    "privacy_consent_version" "text" NOT NULL,
    "privacy_consent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'nuevo'::"text" NOT NULL,
    "archivo_objeto_id" "text",
    "exported_at" timestamp with time zone,
    CONSTRAINT "testimonios_experiencia_ciudad_geoname_id_check" CHECK ((("experiencia_ciudad_geoname_id" IS NULL) OR ("experiencia_ciudad_geoname_id" > 0))),
    CONSTRAINT "testimonios_experiencia_contexto_check" CHECK ((("experiencia_contexto" IS NULL) OR ("experiencia_contexto" = ANY (ARRAY['personal'::"text", 'academico'::"text", 'profesional'::"text", 'otro'::"text"])))),
    CONSTRAINT "testimonios_experiencia_lugar_geonames_check" CHECK ((((NULLIF(TRIM(BOTH FROM COALESCE("experiencia_ciudad_nombre", ''::"text")), ''::"text") IS NULL) AND ("experiencia_ciudad_geoname_id" IS NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("experiencia_pais_nombre", ''::"text")), ''::"text") IS NULL) AND ("experiencia_pais_geoname_id" IS NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("experiencia_lugar_texto", ''::"text")), ''::"text") IS NULL)) OR ((NULLIF(TRIM(BOTH FROM COALESCE("experiencia_ciudad_nombre", ''::"text")), ''::"text") IS NOT NULL) AND ("experiencia_ciudad_geoname_id" IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("experiencia_pais_nombre", ''::"text")), ''::"text") IS NOT NULL) AND ("experiencia_pais_geoname_id" IS NOT NULL)))),
    CONSTRAINT "testimonios_experiencia_pais_geoname_id_check" CHECK ((("experiencia_pais_geoname_id" IS NULL) OR ("experiencia_pais_geoname_id" > 0))),
    CONSTRAINT "testimonios_experiencia_rango_edad_check" CHECK ((("experiencia_rango_edad" IS NULL) OR ("experiencia_rango_edad" = ANY (ARRAY['menos_de_18'::"text", '18_25'::"text", '26_35'::"text", '36_50'::"text", '51_65'::"text", 'mas_de_65'::"text"])))),
    CONSTRAINT "testimonios_linked_archive_refs_no_empty_check" CHECK (("array_position"("linked_archive_refs", ''::"text") IS NULL)),
    CONSTRAINT "testimonios_privacy_consent_check" CHECK ((("privacy_consent" = true) AND ("length"(TRIM(BOTH FROM COALESCE("privacy_consent_version", ''::"text"))) > 0))),
    CONSTRAINT "testimonios_privacy_settings_keys_check" CHECK ((((((((("privacy_settings" - 'mostrar_nombre'::"text") - 'mostrar_ciudad'::"text") - 'mostrar_pais'::"text") - 'mostrar_fecha'::"text") - 'mostrar_rango_edad'::"text") - 'mostrar_contexto'::"text") - 'mostrar_lugar_texto'::"text") = '{}'::"jsonb")),
    CONSTRAINT "testimonios_privacy_settings_object_check" CHECK (("jsonb_typeof"("privacy_settings") = 'object'::"text")),
    CONSTRAINT "testimonios_privacy_settings_types_check" CHECK ((((NOT ("privacy_settings" ? 'mostrar_nombre'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_nombre'::"text")) = 'boolean'::"text")) AND ((NOT ("privacy_settings" ? 'mostrar_ciudad'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_ciudad'::"text")) = 'boolean'::"text")) AND ((NOT ("privacy_settings" ? 'mostrar_pais'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_pais'::"text")) = 'boolean'::"text")) AND ((NOT ("privacy_settings" ? 'mostrar_fecha'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_fecha'::"text")) = 'boolean'::"text")) AND ((NOT ("privacy_settings" ? 'mostrar_rango_edad'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_rango_edad'::"text")) = 'boolean'::"text")) AND ((NOT ("privacy_settings" ? 'mostrar_contexto'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_contexto'::"text")) = 'boolean'::"text")) AND ((NOT ("privacy_settings" ? 'mostrar_lugar_texto'::"text")) OR ("jsonb_typeof"(("privacy_settings" -> 'mostrar_lugar_texto'::"text")) = 'boolean'::"text")))),
    CONSTRAINT "testimonios_status_check" CHECK (("status" = ANY (ARRAY['nuevo'::"text", 'aprobado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "testimonios_testimonio_not_blank_check" CHECK (("length"(TRIM(BOTH FROM COALESCE("testimonio", ''::"text"))) > 0)),
    CONSTRAINT "testimonios_titulo_not_blank_check" CHECK (("length"(TRIM(BOTH FROM COALESCE("titulo", ''::"text"))) > 0))
);


ALTER TABLE "public"."testimonios" OWNER TO "postgres";


COMMENT ON COLUMN "public"."testimonios"."exported_at" IS 'Marca manual de exportacion a CSV publico. NULL = pendiente de export.';



CREATE TABLE IF NOT EXISTS "public"."vinculos_testimonio_archivo" (
    "vinculo_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "testimonio_id" "uuid" NOT NULL,
    "contribucion_id" "uuid" NOT NULL,
    "declared_from" "text" NOT NULL,
    CONSTRAINT "vinculos_testimonio_archivo_declared_from_check" CHECK (("declared_from" = ANY (ARRAY['testimonio_form'::"text", 'documento_form'::"text"])))
);


ALTER TABLE "public"."vinculos_testimonio_archivo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_contribuciones_aprobadas_export_cb" AS
 SELECT COALESCE(NULLIF(TRIM(BOTH FROM "collectionbuilder_id"), ''::"text"), ('contrib_'::"text" || "replace"(("contribucion_id")::"text", '-'::"text", ''::"text"))) AS "objectid",
    NULL::"text" AS "filename",
    NULL::"text" AS "parentid",
    'record'::"text" AS "display_template",
    NULL::"text" AS "display_order",
    "titulo" AS "title",
    ( SELECT "string_agg"(TRIM(BOTH FROM COALESCE(("e"."elem" ->> 'nombre'::"text"), ''::"text")), '; '::"text" ORDER BY "e"."ord") AS "string_agg"
           FROM "jsonb_array_elements"("c"."creadores") WITH ORDINALITY "e"("elem", "ord")
          WHERE ("length"(TRIM(BOTH FROM COALESCE(("e"."elem" ->> 'nombre'::"text"), ''::"text"))) > 0)) AS "creator",
    COALESCE(("fecha")::"text", NULLIF(TRIM(BOTH FROM COALESCE("fecha_texto", ''::"text")), ''::"text")) AS "date",
    "descripcion" AS "description",
    'spa'::"text" AS "language",
    NULL::"text" AS "format",
    'Aporte documental'::"text" AS "type",
    NULL::"text" AS "subtype",
    NULL::"text" AS "subject",
    NULL::"text" AS "historical_context",
    NULL::"text" AS "reception_form",
    NULL::"text" AS "depicted",
    'Aporte ciudadano (Todos a una)'::"text" AS "source",
    ("contribucion_id")::"text" AS "identifier",
        CASE
            WHEN ("rights_type" = 'cc_by_nc_sa'::"text") THEN 'CC BY-NC-SA 4.0'::"text"
            WHEN ("rights_type" = 'copyright'::"text") THEN 'Copyright declarado por colaborador'::"text"
            ELSE "rights_type"
        END AS "rights",
        CASE
            WHEN ("rights_type" = 'cc_by_nc_sa'::"text") THEN 'https://creativecommons.org/licenses/by-nc-sa/4.0/'::"text"
            ELSE NULL::"text"
        END AS "rightstatement",
    COALESCE(NULLIF(TRIM(BOTH FROM COALESCE("lugar_texto", ''::"text")), ''::"text"), NULLIF(TRIM(BOTH FROM "concat_ws"(', '::"text", "ciudad_nombre", "pais_nombre")), ''::"text")) AS "location",
    "ciudad_nombre" AS "city",
    "pais_nombre" AS "country",
    NULL::"text" AS "latitude",
    NULL::"text" AS "longitude",
        CASE
            WHEN ("cardinality"("drive_file_ids") > 0) THEN (('https://drive.google.com/file/d/'::"text" || "drive_file_ids"[1]) || '/view'::"text")
            ELSE NULL::"text"
        END AS "object_location",
    NULL::"text" AS "image_small",
    NULL::"text" AS "image_thumb",
    NULL::"text" AS "image_alt_text",
    NULLIF("array_to_string"("linked_archive_refs", '; '::"text"), ''::"text") AS "relation",
    ("contribucion_id")::"text" AS "database_record",
    NULL::"text" AS "url",
    "contribucion_id",
    "created_at",
    "updated_at",
    "status",
    "collectionbuilder_id",
    "rights_type",
    "rights_holder",
    "drive_file_ids",
    "linked_archive_refs",
    NULLIF("array_to_string"("drive_file_ids", '; '::"text"), ''::"text") AS "drive_file_ids_csv",
    NULLIF("array_to_string"("linked_archive_refs", '; '::"text"), ''::"text") AS "linked_archive_refs_csv",
    (COALESCE(NULLIF(TRIM(BOTH FROM "collectionbuilder_id"), ''::"text"), ''::"text") = ''::"text") AS "is_pending_collectionbuilder_export"
   FROM "public"."contribuciones_archivo" "c"
  WHERE ("status" = 'aprobado'::"text");


ALTER VIEW "public"."vw_contribuciones_aprobadas_export_cb" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_contribuciones_aprobadas_export_cb" IS 'Contribuciones aprobadas preparadas para export CSV manual a CollectionBuilder.';



CREATE OR REPLACE VIEW "public"."vw_contribuciones_moderacion" AS
 SELECT "c"."contribucion_id",
    "c"."created_at",
    "c"."updated_at",
    "c"."status",
    "c"."titulo",
    "c"."descripcion",
    "c"."session_id",
    "c"."collaborator_id",
    "col"."display_name" AS "collaborator_display_name",
    "c"."creadores",
    "c"."fecha",
    "c"."fecha_texto",
    "c"."ciudad_nombre",
    "c"."pais_nombre",
    "c"."lugar_texto",
    "c"."linked_archive_refs",
    "cardinality"("c"."linked_archive_refs") AS "linked_archive_refs_count",
    "c"."rights_type",
    "c"."rights_holder",
    "c"."drive_file_ids",
    "cardinality"("c"."drive_file_ids") AS "drive_file_count",
    COALESCE("vl"."testimonios_vinculados_count", 0) AS "linked_testimonios_count",
    "c"."collectionbuilder_id",
    "c"."privacy_consent_version",
    "c"."privacy_consent_at"
   FROM (("public"."contribuciones_archivo" "c"
     LEFT JOIN "public"."colaboradores" "col" ON (("col"."collaborator_id" = "c"."collaborator_id")))
     LEFT JOIN ( SELECT "v"."contribucion_id",
            ("count"(*))::integer AS "testimonios_vinculados_count"
           FROM "public"."vinculos_testimonio_archivo" "v"
          GROUP BY "v"."contribucion_id") "vl" ON (("vl"."contribucion_id" = "c"."contribucion_id")))
  WHERE ("c"."status" = 'nuevo'::"text");


ALTER VIEW "public"."vw_contribuciones_moderacion" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_contribuciones_moderacion" IS 'Contribuciones documentales en estado nuevo con metadatos clave de revision.';



CREATE OR REPLACE VIEW "public"."vw_testimonios_aprobados_pendientes_export" AS
 SELECT "t"."testimonio_id",
    "t"."created_at",
    "t"."updated_at",
    "t"."exported_at",
    "t"."titulo",
    "t"."testimonio",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_nombre'::"text"))::boolean, false) THEN COALESCE("c"."display_name", ''::"text")
            ELSE ''::"text"
        END AS "display_name",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_fecha'::"text"))::boolean, false) THEN COALESCE(("t"."experiencia_fecha")::"text", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_fecha",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_fecha'::"text"))::boolean, false) THEN COALESCE("t"."experiencia_fecha_texto", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_fecha_texto",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_ciudad'::"text"))::boolean, false) THEN COALESCE("t"."experiencia_ciudad_nombre", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_ciudad_nombre",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_pais'::"text"))::boolean, false) THEN COALESCE("t"."experiencia_pais_nombre", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_pais_nombre",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_lugar_texto'::"text"))::boolean, false) THEN COALESCE("t"."experiencia_lugar_texto", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_lugar_texto",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_contexto'::"text"))::boolean, false) THEN COALESCE("t"."experiencia_contexto", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_contexto",
        CASE
            WHEN COALESCE((("t"."privacy_settings" ->> 'mostrar_rango_edad'::"text"))::boolean, false) THEN COALESCE("t"."experiencia_rango_edad", ''::"text")
            ELSE ''::"text"
        END AS "experiencia_rango_edad",
    COALESCE(("to_json"("t"."linked_archive_refs"))::"text", '[]'::"text") AS "linked_archive_refs"
   FROM ("public"."testimonios" "t"
     LEFT JOIN "public"."colaboradores" "c" ON (("c"."collaborator_id" = "t"."collaborator_id")))
  WHERE (("t"."status" = 'aprobado'::"text") AND ("t"."exported_at" IS NULL));


ALTER VIEW "public"."vw_testimonios_aprobados_pendientes_export" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_testimonios_aprobados_pendientes_export" IS 'Testimonios aprobados pendientes de export CSV (sin usar publicado).';



CREATE OR REPLACE VIEW "public"."vw_testimonios_moderacion" AS
 SELECT "t"."testimonio_id",
    "t"."created_at",
    "t"."updated_at",
    "t"."exported_at",
    "t"."status",
    "t"."titulo",
    "t"."testimonio",
    "t"."session_id",
    "t"."collaborator_id",
    "c"."display_name" AS "collaborator_display_name",
    "t"."experiencia_fecha",
    "t"."experiencia_fecha_texto",
    "t"."experiencia_ciudad_nombre",
    "t"."experiencia_pais_nombre",
    "t"."experiencia_lugar_texto",
    "t"."experiencia_contexto",
    "t"."experiencia_rango_edad",
    "t"."linked_archive_refs",
    "cardinality"("t"."linked_archive_refs") AS "linked_archive_refs_count",
    COALESCE("vl"."contribuciones_vinculadas_count", 0) AS "linked_contribuciones_count",
    "t"."privacy_settings",
    "t"."privacy_consent_version",
    "t"."privacy_consent_at",
    "t"."archivo_objeto_id"
   FROM (("public"."testimonios" "t"
     LEFT JOIN "public"."colaboradores" "c" ON (("c"."collaborator_id" = "t"."collaborator_id")))
     LEFT JOIN ( SELECT "v"."testimonio_id",
            ("count"(*))::integer AS "contribuciones_vinculadas_count"
           FROM "public"."vinculos_testimonio_archivo" "v"
          GROUP BY "v"."testimonio_id") "vl" ON (("vl"."testimonio_id" = "t"."testimonio_id")))
  WHERE ("t"."status" = 'nuevo'::"text");


ALTER VIEW "public"."vw_testimonios_moderacion" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_testimonios_moderacion" IS 'Testimonios en estado nuevo para revision de moderacion.';



ALTER TABLE ONLY "public"."evaluaciones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."evaluaciones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."participacion_rate_limit_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."participacion_rate_limit_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."proyecto_activo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."proyecto_activo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."colaboradores"
    ADD CONSTRAINT "colaboradores_email_hash_key" UNIQUE ("email_hash");



ALTER TABLE ONLY "public"."colaboradores"
    ADD CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("collaborator_id");



ALTER TABLE ONLY "public"."contribuciones_archivo"
    ADD CONSTRAINT "contribuciones_archivo_pkey" PRIMARY KEY ("contribucion_id");



ALTER TABLE ONLY "public"."contribuciones_upload_staging"
    ADD CONSTRAINT "contribuciones_upload_staging_pkey" PRIMARY KEY ("staging_id");



ALTER TABLE ONLY "public"."contribuciones_upload_staging"
    ADD CONSTRAINT "contribuciones_upload_staging_token_jti_unique" UNIQUE ("token_jti");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participacion_funnel_events"
    ADD CONSTRAINT "participacion_funnel_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participacion_funnel_events"
    ADD CONSTRAINT "participacion_funnel_events_session_event_key" UNIQUE ("session_id", "event_name");



ALTER TABLE ONLY "public"."participacion_pilot_events"
    ADD CONSTRAINT "participacion_pilot_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participacion_pilot_events"
    ADD CONSTRAINT "participacion_pilot_events_session_event_key" UNIQUE ("session_id", "event_key");



ALTER TABLE ONLY "public"."participacion_pilot_settings"
    ADD CONSTRAINT "participacion_pilot_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participacion_rate_limit_events"
    ADD CONSTRAINT "participacion_rate_limit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proyecto_activo"
    ADD CONSTRAINT "proyecto_activo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sesiones"
    ADD CONSTRAINT "sesiones_browser_session_token_key" UNIQUE ("browser_session_token");



ALTER TABLE ONLY "public"."sesiones"
    ADD CONSTRAINT "sesiones_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."testimonios"
    ADD CONSTRAINT "testimonios_pkey" PRIMARY KEY ("testimonio_id");



ALTER TABLE ONLY "public"."vinculos_testimonio_archivo"
    ADD CONSTRAINT "vinculos_testimonio_archivo_pkey" PRIMARY KEY ("vinculo_id");



ALTER TABLE ONLY "public"."vinculos_testimonio_archivo"
    ADD CONSTRAINT "vinculos_testimonio_archivo_unique" UNIQUE ("testimonio_id", "contribucion_id");



CREATE INDEX "idx_colaboradores_city_geoname_id" ON "public"."colaboradores" USING "btree" ("city_geoname_id");



CREATE INDEX "idx_colaboradores_country_geoname_id" ON "public"."colaboradores" USING "btree" ("country_geoname_id");



CREATE INDEX "idx_colaboradores_email_hash" ON "public"."colaboradores" USING "btree" ("email_hash");



CREATE INDEX "idx_colaboradores_relacion_obra_gin" ON "public"."colaboradores" USING "gin" ("relacion_obra");



CREATE INDEX "idx_contribuciones_archivo_ciudad_geoname_id" ON "public"."contribuciones_archivo" USING "btree" ("ciudad_geoname_id");



CREATE INDEX "idx_contribuciones_archivo_collaborator_id" ON "public"."contribuciones_archivo" USING "btree" ("collaborator_id");



CREATE INDEX "idx_contribuciones_archivo_created_at_desc" ON "public"."contribuciones_archivo" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contribuciones_archivo_linked_archive_refs_gin" ON "public"."contribuciones_archivo" USING "gin" ("linked_archive_refs");



CREATE INDEX "idx_contribuciones_archivo_pais_geoname_id" ON "public"."contribuciones_archivo" USING "btree" ("pais_geoname_id");



CREATE INDEX "idx_contribuciones_archivo_session_id" ON "public"."contribuciones_archivo" USING "btree" ("session_id");



CREATE INDEX "idx_contribuciones_archivo_status" ON "public"."contribuciones_archivo" USING "btree" ("status");



CREATE INDEX "idx_evaluaciones_event_type" ON "public"."evaluaciones" USING "btree" ("event_type");



CREATE INDEX "idx_evaluaciones_nota" ON "public"."evaluaciones" USING "btree" ("nota_id", "nota_change");



CREATE INDEX "idx_evaluaciones_nota_id" ON "public"."evaluaciones" USING "btree" ("nota_id");



CREATE INDEX "idx_evaluaciones_pasaje" ON "public"."evaluaciones" USING "btree" ("pasaje_id");



CREATE INDEX "idx_evaluaciones_selected_text" ON "public"."evaluaciones" USING "btree" ("selected_text") WHERE ("event_type" = 'falta_nota'::"text");



CREATE INDEX "idx_evaluaciones_session" ON "public"."evaluaciones" USING "btree" ("session_id");



CREATE INDEX "idx_evaluaciones_session_id" ON "public"."evaluaciones" USING "btree" ("session_id");



CREATE INDEX "idx_evaluaciones_timestamp" ON "public"."evaluaciones" USING "btree" ("timestamp");



CREATE INDEX "idx_participacion_funnel_events_created_at" ON "public"."participacion_funnel_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_participacion_funnel_events_event_name_created_at" ON "public"."participacion_funnel_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_participacion_pilot_events_created_at" ON "public"."participacion_pilot_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_participacion_pilot_events_event_context_created_at" ON "public"."participacion_pilot_events" USING "btree" ("event_name", "context", "created_at" DESC);



CREATE INDEX "idx_participacion_pilot_events_form" ON "public"."participacion_pilot_events" USING "btree" ("form_name", "event_name", "created_at" DESC) WHERE ("form_name" IS NOT NULL);



CREATE INDEX "idx_participacion_pilot_events_note" ON "public"."participacion_pilot_events" USING "btree" ("context", "nota_id", "nota_change") WHERE ("nota_id" IS NOT NULL);



CREATE INDEX "idx_prle_action_iphash_created_at" ON "public"."participacion_rate_limit_events" USING "btree" ("action", "ip_hash", "created_at");



CREATE INDEX "idx_prle_action_session_created_at" ON "public"."participacion_rate_limit_events" USING "btree" ("action", "session_id", "created_at");



CREATE INDEX "idx_sesiones_collaborator_id" ON "public"."sesiones" USING "btree" ("collaborator_id");



CREATE INDEX "idx_testimonios_collaborator_id" ON "public"."testimonios" USING "btree" ("collaborator_id");



CREATE INDEX "idx_testimonios_created_at_desc" ON "public"."testimonios" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_testimonios_experiencia_ciudad_geoname_id" ON "public"."testimonios" USING "btree" ("experiencia_ciudad_geoname_id");



CREATE INDEX "idx_testimonios_experiencia_pais_geoname_id" ON "public"."testimonios" USING "btree" ("experiencia_pais_geoname_id");



CREATE INDEX "idx_testimonios_linked_archive_refs_gin" ON "public"."testimonios" USING "gin" ("linked_archive_refs");



CREATE INDEX "idx_testimonios_session_id" ON "public"."testimonios" USING "btree" ("session_id");



CREATE INDEX "idx_testimonios_status" ON "public"."testimonios" USING "btree" ("status");



CREATE INDEX "idx_testimonios_status_exported_at_created_at" ON "public"."testimonios" USING "btree" ("status", "exported_at", "created_at");



CREATE INDEX "idx_upload_staging_finalized_contribucion_id" ON "public"."contribuciones_upload_staging" USING "btree" ("finalized_contribucion_id");



CREATE INDEX "idx_upload_staging_session_created_at" ON "public"."contribuciones_upload_staging" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_upload_staging_status_expires_at" ON "public"."contribuciones_upload_staging" USING "btree" ("status", "expires_at");



CREATE UNIQUE INDEX "idx_upload_staging_token_jti" ON "public"."contribuciones_upload_staging" USING "btree" ("token_jti");



CREATE INDEX "idx_vinculos_testimonio_archivo_contribucion_id" ON "public"."vinculos_testimonio_archivo" USING "btree" ("contribucion_id");



CREATE OR REPLACE TRIGGER "trg_colaboradores_set_updated_at" BEFORE UPDATE ON "public"."colaboradores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contribuciones_archivo_set_updated_at" BEFORE UPDATE ON "public"."contribuciones_archivo" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contribuciones_touch_last_activity" AFTER INSERT ON "public"."contribuciones_archivo" FOR EACH ROW EXECUTE FUNCTION "public"."touch_session_last_activity"();



CREATE OR REPLACE TRIGGER "trg_contribuciones_upload_staging_set_updated_at" BEFORE UPDATE ON "public"."contribuciones_upload_staging" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_evaluaciones_touch_last_activity" AFTER INSERT ON "public"."evaluaciones" FOR EACH ROW EXECUTE FUNCTION "public"."touch_session_last_activity"();



CREATE OR REPLACE TRIGGER "trg_testimonios_set_updated_at" BEFORE UPDATE ON "public"."testimonios" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_testimonios_touch_last_activity" AFTER INSERT ON "public"."testimonios" FOR EACH ROW EXECUTE FUNCTION "public"."touch_session_last_activity"();



ALTER TABLE ONLY "public"."contribuciones_archivo"
    ADD CONSTRAINT "contribuciones_archivo_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."colaboradores"("collaborator_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contribuciones_archivo"
    ADD CONSTRAINT "contribuciones_archivo_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."contribuciones_upload_staging"
    ADD CONSTRAINT "contribuciones_upload_staging_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."colaboradores"("collaborator_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contribuciones_upload_staging"
    ADD CONSTRAINT "contribuciones_upload_staging_finalized_contribucion_id_fkey" FOREIGN KEY ("finalized_contribucion_id") REFERENCES "public"."contribuciones_archivo"("contribucion_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contribuciones_upload_staging"
    ADD CONSTRAINT "contribuciones_upload_staging_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participacion_funnel_events"
    ADD CONSTRAINT "participacion_funnel_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participacion_pilot_events"
    ADD CONSTRAINT "participacion_pilot_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participacion_rate_limit_events"
    ADD CONSTRAINT "participacion_rate_limit_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sesiones"
    ADD CONSTRAINT "sesiones_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."colaboradores"("collaborator_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testimonios"
    ADD CONSTRAINT "testimonios_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."colaboradores"("collaborator_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."testimonios"
    ADD CONSTRAINT "testimonios_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vinculos_testimonio_archivo"
    ADD CONSTRAINT "vinculos_testimonio_archivo_contribucion_id_fkey" FOREIGN KEY ("contribucion_id") REFERENCES "public"."contribuciones_archivo"("contribucion_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vinculos_testimonio_archivo"
    ADD CONSTRAINT "vinculos_testimonio_archivo_testimonio_id_fkey" FOREIGN KEY ("testimonio_id") REFERENCES "public"."testimonios"("testimonio_id") ON DELETE CASCADE;



ALTER TABLE "public"."colaboradores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contribuciones_archivo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contribuciones_upload_staging" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participacion_funnel_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participacion_pilot_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participacion_pilot_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participacion_rate_limit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proyecto_activo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sesiones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testimonios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vinculos_testimonio_archivo" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_assert_rate_limit"("p_action" "text", "p_session_id" "uuid", "p_ip_hash" "text", "p_session_limit" integer, "p_ip_limit" integer, "p_window" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_assert_rate_limit"("p_action" "text", "p_session_id" "uuid", "p_ip_hash" "text", "p_session_limit" integer, "p_ip_limit" integer, "p_window" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_request_ip_hash"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_request_ip_hash"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_request_ip_text"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_request_ip_text"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_bootstrap_session"("p_browser_session_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_bootstrap_session"("p_browser_session_token" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_bootstrap_session"("p_browser_session_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_bootstrap_session"("p_browser_session_token" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_collaborator_login_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_collaborator_register_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text", "p_anio_nacimiento" integer, "p_city_name" "text", "p_city_geoname_id" bigint, "p_country_name" "text", "p_country_geoname_id" bigint, "p_relacion_obra" "text"[], "p_consent_rgpd" boolean, "p_consent_rgpd_version" "text", "p_consent_accepted_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text", "p_anio_nacimiento" integer, "p_city_name" "text", "p_city_geoname_id" bigint, "p_country_name" "text", "p_country_geoname_id" bigint, "p_relacion_obra" "text"[], "p_consent_rgpd" boolean, "p_consent_rgpd_version" "text", "p_consent_accepted_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text", "p_anio_nacimiento" integer, "p_city_name" "text", "p_city_geoname_id" bigint, "p_country_name" "text", "p_country_geoname_id" bigint, "p_relacion_obra" "text"[], "p_consent_rgpd" boolean, "p_consent_rgpd_version" "text", "p_consent_accepted_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register_and_bind_session"("p_session_id" "uuid", "p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text", "p_anio_nacimiento" integer, "p_city_name" "text", "p_city_geoname_id" bigint, "p_country_name" "text", "p_country_geoname_id" bigint, "p_relacion_obra" "text"[], "p_consent_rgpd" boolean, "p_consent_rgpd_version" "text", "p_consent_accepted_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_create_session"("p_modo_participacion" "text", "p_collaborator_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_create_session"("p_modo_participacion" "text", "p_collaborator_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_create_session"("p_modo_participacion" "text", "p_collaborator_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_create_session"("p_modo_participacion" "text", "p_collaborator_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_global_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_global_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_global_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_global_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_link_testimonio_contribucion"("p_session_id" "uuid", "p_testimonio_id" "uuid", "p_contribucion_id" "uuid", "p_declared_from" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_link_testimonio_contribucion"("p_session_id" "uuid", "p_testimonio_id" "uuid", "p_contribucion_id" "uuid", "p_declared_from" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_link_testimonio_contribucion"("p_session_id" "uuid", "p_testimonio_id" "uuid", "p_contribucion_id" "uuid", "p_declared_from" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_link_testimonio_contribucion"("p_session_id" "uuid", "p_testimonio_id" "uuid", "p_contribucion_id" "uuid", "p_declared_from" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_list_testimonios_publicos"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_list_testimonios_publicos"("p_limit" integer, "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_list_testimonios_publicos"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_list_testimonios_publicos"("p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_set_mode_anonimo"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_set_mode_anonimo"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_set_mode_anonimo"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_set_mode_anonimo"("p_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo"("p_session_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_drive_file_ids" "text"[], "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo"("p_session_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_drive_file_ids" "text"[], "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo"("p_session_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_drive_file_ids" "text"[], "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo"("p_session_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_drive_file_ids" "text"[], "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo_staged"("p_session_id" "uuid", "p_staging_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo_staged"("p_session_id" "uuid", "p_staging_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo_staged"("p_session_id" "uuid", "p_staging_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_submit_contribucion_archivo_staged"("p_session_id" "uuid", "p_staging_id" "uuid", "p_titulo" "text", "p_descripcion" "text", "p_creadores" "jsonb", "p_fecha" "date", "p_fecha_texto" "text", "p_ciudad_nombre" "text", "p_ciudad_geoname_id" bigint, "p_pais_nombre" "text", "p_pais_geoname_id" bigint, "p_lugar_texto" "text", "p_linked_archive_refs" "text"[], "p_rights_type" "text", "p_rights_holder" "text", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_change" "text", "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_change" "text", "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_change" "text", "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_change" "text", "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_submit_testimonio"("p_session_id" "uuid", "p_titulo" "text", "p_testimonio" "text", "p_experiencia_fecha" "date", "p_experiencia_fecha_texto" "text", "p_experiencia_ciudad_nombre" "text", "p_experiencia_ciudad_geoname_id" bigint, "p_experiencia_pais_nombre" "text", "p_experiencia_pais_geoname_id" bigint, "p_experiencia_lugar_texto" "text", "p_experiencia_contexto" "text", "p_experiencia_rango_edad" "text", "p_linked_archive_refs" "text"[], "p_privacy_settings" "jsonb", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_testimonio"("p_session_id" "uuid", "p_titulo" "text", "p_testimonio" "text", "p_experiencia_fecha" "date", "p_experiencia_fecha_texto" "text", "p_experiencia_ciudad_nombre" "text", "p_experiencia_ciudad_geoname_id" bigint, "p_experiencia_pais_nombre" "text", "p_experiencia_pais_geoname_id" bigint, "p_experiencia_lugar_texto" "text", "p_experiencia_contexto" "text", "p_experiencia_rango_edad" "text", "p_linked_archive_refs" "text"[], "p_privacy_settings" "jsonb", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_submit_testimonio"("p_session_id" "uuid", "p_titulo" "text", "p_testimonio" "text", "p_experiencia_fecha" "date", "p_experiencia_fecha_texto" "text", "p_experiencia_ciudad_nombre" "text", "p_experiencia_ciudad_geoname_id" bigint, "p_experiencia_pais_nombre" "text", "p_experiencia_pais_geoname_id" bigint, "p_experiencia_lugar_texto" "text", "p_experiencia_contexto" "text", "p_experiencia_rango_edad" "text", "p_linked_archive_refs" "text"[], "p_privacy_settings" "jsonb", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_submit_testimonio"("p_session_id" "uuid", "p_titulo" "text", "p_testimonio" "text", "p_experiencia_fecha" "date", "p_experiencia_fecha_texto" "text", "p_experiencia_ciudad_nombre" "text", "p_experiencia_ciudad_geoname_id" bigint, "p_experiencia_pais_nombre" "text", "p_experiencia_pais_geoname_id" bigint, "p_experiencia_lugar_texto" "text", "p_experiencia_contexto" "text", "p_experiencia_rango_edad" "text", "p_linked_archive_refs" "text"[], "p_privacy_settings" "jsonb", "p_privacy_consent" boolean, "p_privacy_consent_version" "text", "p_privacy_consent_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_track_participacion_funnel_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_track_participacion_funnel_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_track_participacion_funnel_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_track_participacion_funnel_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_metadata" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_track_participacion_pilot_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_nota_id" "text", "p_nota_change" "text", "p_pasaje_id" integer, "p_form_name" "text", "p_field_name" "text", "p_event_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_track_participacion_pilot_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_nota_id" "text", "p_nota_change" "text", "p_pasaje_id" integer, "p_form_name" "text", "p_field_name" "text", "p_event_key" "text", "p_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."rpc_track_participacion_pilot_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_nota_id" "text", "p_nota_change" "text", "p_pasaje_id" integer, "p_form_name" "text", "p_field_name" "text", "p_event_key" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_track_participacion_pilot_event"("p_session_id" "uuid", "p_event_name" "text", "p_context" "text", "p_nota_id" "text", "p_nota_change" "text", "p_pasaje_id" integer, "p_form_name" "text", "p_field_name" "text", "p_event_key" "text", "p_metadata" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_session_last_activity"() TO "service_role";



GRANT ALL ON TABLE "public"."colaboradores" TO "service_role";



GRANT ALL ON TABLE "public"."contribuciones_archivo" TO "service_role";



GRANT ALL ON TABLE "public"."contribuciones_upload_staging" TO "service_role";



GRANT ALL ON TABLE "public"."evaluaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluaciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluaciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluaciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."participacion_funnel_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."participacion_funnel_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."participacion_pilot_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."participacion_pilot_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."participacion_pilot_settings" TO "service_role";



GRANT ALL ON TABLE "public"."participacion_rate_limit_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."participacion_rate_limit_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."proyecto_activo" TO "anon";
GRANT ALL ON TABLE "public"."proyecto_activo" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_activo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."proyecto_activo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."proyecto_activo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."proyecto_activo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sesiones" TO "service_role";



GRANT ALL ON TABLE "public"."testimonios" TO "service_role";



GRANT ALL ON TABLE "public"."vinculos_testimonio_archivo" TO "service_role";



GRANT ALL ON TABLE "public"."vw_contribuciones_aprobadas_export_cb" TO "service_role";



GRANT ALL ON TABLE "public"."vw_contribuciones_moderacion" TO "service_role";



GRANT ALL ON TABLE "public"."vw_testimonios_aprobados_pendientes_export" TO "service_role";



GRANT ALL ON TABLE "public"."vw_testimonios_moderacion" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







