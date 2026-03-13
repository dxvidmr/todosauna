-- ============================================
-- PHASE 15: optional collaborator profile fields on register RPC
-- ============================================

drop function if exists public.rpc_collaborator_register_and_bind_session(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  text,
  timestamp with time zone
);

drop function if exists public.rpc_collaborator_register_and_bind_session(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  bigint,
  text,
  bigint,
  text[],
  boolean,
  text,
  timestamp with time zone
);

create or replace function public.rpc_collaborator_register_and_bind_session(
  p_session_id uuid,
  p_email_hash text,
  p_display_name text default null::text,
  p_nivel_estudios text default null::text,
  p_disciplina text default null::text,
  p_anio_nacimiento integer default null::integer,
  p_city_name text default null::text,
  p_city_geoname_id bigint default null::bigint,
  p_country_name text default null::text,
  p_country_geoname_id bigint default null::bigint,
  p_relacion_obra text[] default null::text[],
  p_consent_rgpd boolean default false,
  p_consent_rgpd_version text default null::text,
  p_consent_accepted_at timestamp with time zone default null::timestamp with time zone
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

alter function public.rpc_collaborator_register_and_bind_session(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  bigint,
  text,
  bigint,
  text[],
  boolean,
  text,
  timestamp with time zone
) owner to postgres;

revoke all on function public.rpc_collaborator_register_and_bind_session(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  bigint,
  text,
  bigint,
  text[],
  boolean,
  text,
  timestamp with time zone
) from public;

grant execute on function public.rpc_collaborator_register_and_bind_session(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  bigint,
  text,
  bigint,
  text[],
  boolean,
  text,
  timestamp with time zone
) to anon, authenticated, service_role;
