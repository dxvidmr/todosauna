-- Ajustar semantica de last_activity_at:
-- solo debe reflejar actividad de participacion, no acceso/login/cambio de modo.

create or replace function public.rpc_bootstrap_session(
  p_browser_session_token uuid default null::uuid
)
returns table(
  session_id uuid,
  browser_session_token uuid,
  modo_participacion text,
  collaborator_id uuid,
  created_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  collaborator_created_at timestamp with time zone
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

alter function public.rpc_bootstrap_session(uuid) owner to postgres;
revoke all on function public.rpc_bootstrap_session(uuid) from public;
grant execute on function public.rpc_bootstrap_session(uuid) to anon, authenticated, service_role;

create or replace function public.rpc_set_mode_anonimo(
  p_session_id uuid
)
returns table(
  session_id uuid,
  browser_session_token uuid,
  modo_participacion text,
  collaborator_id uuid,
  created_at timestamp with time zone,
  last_activity_at timestamp with time zone
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

create or replace function public.rpc_collaborator_register_and_bind_session(
  p_session_id uuid,
  p_email_hash text,
  p_display_name text default null::text,
  p_nivel_estudios text default null::text,
  p_disciplina text default null::text
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
        'disciplina', v_existing.disciplina,
        'created_at', v_existing.created_at
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

create or replace function public.rpc_collaborator_login_and_bind_session(
  p_session_id uuid,
  p_email_hash text
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
