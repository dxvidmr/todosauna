-- ============================================
-- PHASE 7.1: contribuciones_archivo allows metadata-only submissions
-- ============================================

alter table "public"."contribuciones_archivo"
  alter column "rights_type" drop not null;

alter table "public"."contribuciones_archivo"
  drop constraint if exists "contribuciones_archivo_rights_type_check";

alter table "public"."contribuciones_archivo"
  drop constraint if exists "contribuciones_archivo_rights_holder_consistency_check";

alter table "public"."contribuciones_archivo"
  drop constraint if exists "contribuciones_archivo_drive_file_ids_check";

alter table "public"."contribuciones_archivo"
  add constraint "contribuciones_archivo_drive_file_ids_check"
    check (array_position("drive_file_ids", '') is null);

alter table "public"."contribuciones_archivo"
  add constraint "contribuciones_archivo_rights_conditional_check"
    check (
      (
        cardinality("drive_file_ids") = 0
        and "rights_type" is null
        and nullif(trim(coalesce("rights_holder", '')), '') is null
      )
      or
      (
        cardinality("drive_file_ids") >= 1
        and "rights_type" in ('cc_by_nc_sa', 'copyright')
        and (
          (
            "rights_type" = 'copyright'
            and length(trim(coalesce("rights_holder", ''))) > 0
          )
          or
          (
            "rights_type" = 'cc_by_nc_sa'
            and "rights_holder" is null
          )
        )
      )
    );