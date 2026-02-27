-- ==========================================================
-- PHASE 8.2c: drop testimonios.publicado (exported_at model)
-- ==========================================================

drop view if exists "public"."vw_testimonios_moderacion";

create view "public"."vw_testimonios_moderacion" as
select
  t.testimonio_id,
  t.created_at,
  t.updated_at,
  t.exported_at,
  t.status,
  t.titulo,
  t.testimonio,
  t.session_id,
  t.collaborator_id,
  c.display_name as collaborator_display_name,
  t.experiencia_fecha,
  t.experiencia_fecha_texto,
  t.experiencia_ciudad_nombre,
  t.experiencia_pais_nombre,
  t.experiencia_lugar_texto,
  t.experiencia_contexto,
  t.experiencia_rango_edad,
  t.linked_archive_refs,
  cardinality(t.linked_archive_refs) as linked_archive_refs_count,
  coalesce(vl.contribuciones_vinculadas_count, 0)::integer as linked_contribuciones_count,
  t.privacy_settings,
  t.privacy_consent_version,
  t.privacy_consent_at,
  t.archivo_objeto_id
from public.testimonios t
left join public.colaboradores c
  on c.collaborator_id = t.collaborator_id
left join (
  select
    v.testimonio_id,
    count(*)::integer as contribuciones_vinculadas_count
  from public.vinculos_testimonio_archivo v
  group by v.testimonio_id
) vl
  on vl.testimonio_id = t.testimonio_id
where t.status = 'nuevo';

comment on view "public"."vw_testimonios_moderacion" is
  'Testimonios en estado nuevo para revision de moderacion.';

revoke all on table "public"."vw_testimonios_moderacion" from public;
revoke all on table "public"."vw_testimonios_moderacion" from "anon", "authenticated";
grant select on table "public"."vw_testimonios_moderacion" to "service_role";

drop function if exists "public"."rpc_submit_testimonio"(
  uuid, text, text, date, text, text, bigint, text, bigint, text, text, text, text[], jsonb, boolean, text, timestamp with time zone
);

create function "public"."rpc_submit_testimonio"(
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
  "status" text
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
    v_new.status;
end;
$$;

revoke all on function "public"."rpc_submit_testimonio"(uuid, text, text, date, text, text, bigint, text, bigint, text, text, text, text[], jsonb, boolean, text, timestamp with time zone) from public;
grant execute on function "public"."rpc_submit_testimonio"(uuid, text, text, date, text, text, bigint, text, bigint, text, text, text, text[], jsonb, boolean, text, timestamp with time zone) to "anon", "authenticated", "service_role";

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
    and t.exported_at is not null
  order by t.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

alter table "public"."testimonios"
  drop constraint if exists "testimonios_publicado_consistency_check";

drop index if exists "public"."idx_testimonios_status_publicado";

alter table "public"."testimonios"
  drop column if exists "publicado";
