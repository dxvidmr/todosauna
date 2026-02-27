-- ============================================
-- PHASE 8.2a: moderation operational views
-- ============================================

-- =====================================================
-- View 1: testimonios pendientes para moderacion diaria
-- =====================================================

create or replace view "public"."vw_testimonios_moderacion" as
select
  t.testimonio_id,
  t.created_at,
  t.updated_at,
  t.status,
  t.publicado,
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

-- ===========================================================
-- View 2: contribuciones pendientes con foco en derechos/files
-- ===========================================================

create or replace view "public"."vw_contribuciones_moderacion" as
select
  c.contribucion_id,
  c.created_at,
  c.updated_at,
  c.status,
  c.titulo,
  c.descripcion,
  c.session_id,
  c.collaborator_id,
  col.display_name as collaborator_display_name,
  c.creadores,
  c.fecha,
  c.fecha_texto,
  c.ciudad_nombre,
  c.pais_nombre,
  c.lugar_texto,
  c.linked_archive_refs,
  cardinality(c.linked_archive_refs) as linked_archive_refs_count,
  c.rights_type,
  c.rights_holder,
  c.drive_file_ids,
  cardinality(c.drive_file_ids) as drive_file_count,
  coalesce(vl.testimonios_vinculados_count, 0)::integer as linked_testimonios_count,
  c.collectionbuilder_id,
  c.privacy_consent_version,
  c.privacy_consent_at
from public.contribuciones_archivo c
left join public.colaboradores col
  on col.collaborator_id = c.collaborator_id
left join (
  select
    v.contribucion_id,
    count(*)::integer as testimonios_vinculados_count
  from public.vinculos_testimonio_archivo v
  group by v.contribucion_id
) vl
  on vl.contribucion_id = c.contribucion_id
where c.status = 'nuevo';

comment on view "public"."vw_contribuciones_moderacion" is
  'Contribuciones documentales en estado nuevo con metadatos clave de revision.';

-- =======================================================================
-- View 3: contribuciones aprobadas listas para export manual a CB (CSV)
-- =======================================================================

create or replace view "public"."vw_contribuciones_aprobadas_export_cb" as
select
  -- Columnas CollectionBuilder CSV
  coalesce(
    nullif(trim(c.collectionbuilder_id), ''),
    'contrib_' || replace(c.contribucion_id::text, '-', '')
  ) as objectid,
  null::text as filename,
  null::text as parentid,
  'record'::text as display_template,
  null::text as display_order,
  c.titulo as title,
  (
    select string_agg(trim(coalesce(e.elem ->> 'nombre', '')), '; ' order by e.ord)
    from jsonb_array_elements(c.creadores) with ordinality as e(elem, ord)
    where length(trim(coalesce(e.elem ->> 'nombre', ''))) > 0
  ) as creator,
  coalesce(c.fecha::text, nullif(trim(coalesce(c.fecha_texto, '')), '')) as date,
  c.descripcion as description,
  'spa'::text as language,
  null::text as format,
  'Aporte documental'::text as type,
  null::text as subtype,
  null::text as subject,
  null::text as historical_context,
  null::text as reception_form,
  null::text as depicted,
  'Aporte ciudadano (Todos a una)'::text as source,
  c.contribucion_id::text as identifier,
  case
    when c.rights_type = 'cc_by_nc_sa' then 'CC BY-NC-SA 4.0'
    when c.rights_type = 'copyright' then 'Copyright declarado por colaborador'
    else c.rights_type
  end as rights,
  case
    when c.rights_type = 'cc_by_nc_sa' then 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
    else null::text
  end as rightstatement,
  coalesce(
    nullif(trim(coalesce(c.lugar_texto, '')), ''),
    nullif(trim(concat_ws(', ', c.ciudad_nombre, c.pais_nombre)), '')
  ) as location,
  c.ciudad_nombre as city,
  c.pais_nombre as country,
  null::text as latitude,
  null::text as longitude,
  case
    when cardinality(c.drive_file_ids) > 0 then 'https://drive.google.com/file/d/' || c.drive_file_ids[1] || '/view'
    else null::text
  end as object_location,
  null::text as image_small,
  null::text as image_thumb,
  null::text as image_alt_text,
  nullif(array_to_string(c.linked_archive_refs, '; '), '') as relation,
  c.contribucion_id::text as database_record,
  null::text as url,

  -- Columnas operativas extra
  c.contribucion_id,
  c.created_at,
  c.updated_at,
  c.status,
  c.collectionbuilder_id,
  c.rights_type,
  c.rights_holder,
  c.drive_file_ids,
  c.linked_archive_refs,
  nullif(array_to_string(c.drive_file_ids, '; '), '') as drive_file_ids_csv,
  nullif(array_to_string(c.linked_archive_refs, '; '), '') as linked_archive_refs_csv,
  (
    coalesce(nullif(trim(c.collectionbuilder_id), ''), '') = ''
  ) as is_pending_collectionbuilder_export
from public.contribuciones_archivo c
where c.status = 'aprobado';

comment on view "public"."vw_contribuciones_aprobadas_export_cb" is
  'Contribuciones aprobadas preparadas para export CSV manual a CollectionBuilder.';

-- =====================
-- ACL hardening (views)
-- =====================

revoke all on table "public"."vw_testimonios_moderacion" from public;
revoke all on table "public"."vw_contribuciones_moderacion" from public;
revoke all on table "public"."vw_contribuciones_aprobadas_export_cb" from public;

revoke all on table "public"."vw_testimonios_moderacion" from "anon", "authenticated";
revoke all on table "public"."vw_contribuciones_moderacion" from "anon", "authenticated";
revoke all on table "public"."vw_contribuciones_aprobadas_export_cb" from "anon", "authenticated";

grant select on table "public"."vw_testimonios_moderacion" to "service_role";
grant select on table "public"."vw_contribuciones_moderacion" to "service_role";
grant select on table "public"."vw_contribuciones_aprobadas_export_cb" to "service_role";
