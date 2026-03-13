-- ============================================
-- PHASE 14: explicit privacy consent on collaborator registration
-- ============================================

drop function if exists public.rpc_collaborator_register_and_bind_session(
  uuid,
  text,
  text,
  text,
  text
);

create or replace function public.rpc_collaborator_register_and_bind_session(
  p_session_id uuid,
  p_email_hash text,
  p_display_name text default null::text,
  p_nivel_estudios text default null::text,
  p_disciplina text default null::text,
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
        'created_at', v_existing.created_at
      )
    );
  end if;

  insert into public.colaboradores (
    email_hash,
    display_name,
    nivel_estudios,
    disciplina,
    consent_rgpd,
    consent_rgpd_version,
    consent_accepted_at
  )
  values (
    v_email_hash,
    nullif(trim(coalesce(p_display_name, '')), ''),
    nullif(trim(coalesce(p_nivel_estudios, '')), ''),
    nullif(trim(coalesce(p_disciplina, '')), ''),
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
  boolean,
  text,
  timestamp with time zone
) to anon, authenticated, service_role;
