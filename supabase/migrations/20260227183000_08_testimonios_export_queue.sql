-- ============================================
-- PHASE 8.2b: testimonios export queue (manual)
-- ============================================

alter table "public"."testimonios"
  add column if not exists "exported_at" timestamp with time zone;

comment on column "public"."testimonios"."exported_at" is
  'Marca manual de exportacion a CSV publico. NULL = pendiente de export.';

create index if not exists "idx_testimonios_status_exported_at_created_at"
  on "public"."testimonios" using btree ("status", "exported_at", "created_at");

create or replace view "public"."vw_testimonios_aprobados_pendientes_export" as
select
  t.testimonio_id,
  t.created_at,
  t.updated_at,
  t.exported_at,
  t.titulo,
  t.testimonio,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_nombre')::boolean, false)
      then coalesce(c.display_name, '')
    else ''
  end as display_name,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_fecha')::boolean, false)
      then coalesce(t.experiencia_fecha::text, '')
    else ''
  end as experiencia_fecha,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_fecha')::boolean, false)
      then coalesce(t.experiencia_fecha_texto, '')
    else ''
  end as experiencia_fecha_texto,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_ciudad')::boolean, false)
      then coalesce(t.experiencia_ciudad_nombre, '')
    else ''
  end as experiencia_ciudad_nombre,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_pais')::boolean, false)
      then coalesce(t.experiencia_pais_nombre, '')
    else ''
  end as experiencia_pais_nombre,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_lugar_texto')::boolean, false)
      then coalesce(t.experiencia_lugar_texto, '')
    else ''
  end as experiencia_lugar_texto,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_contexto')::boolean, false)
      then coalesce(t.experiencia_contexto, '')
    else ''
  end as experiencia_contexto,
  case
    when coalesce((t.privacy_settings ->> 'mostrar_rango_edad')::boolean, false)
      then coalesce(t.experiencia_rango_edad, '')
    else ''
  end as experiencia_rango_edad,
  coalesce(to_json(t.linked_archive_refs)::text, '[]') as linked_archive_refs
from "public"."testimonios" t
left join "public"."colaboradores" c
  on c.collaborator_id = t.collaborator_id
where t.status = 'aprobado'
  and t.exported_at is null;

comment on view "public"."vw_testimonios_aprobados_pendientes_export" is
  'Testimonios aprobados pendientes de export CSV (sin usar publicado).';

revoke all on table "public"."vw_testimonios_aprobados_pendientes_export" from public;
revoke all on table "public"."vw_testimonios_aprobados_pendientes_export" from "anon", "authenticated";
grant select on table "public"."vw_testimonios_aprobados_pendientes_export" to "service_role";
