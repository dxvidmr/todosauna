-- ============================================
-- PHASE 2: testimonios + contribuciones + vinculos
-- ============================================

-- ============================================
-- testimonios
-- ============================================

create table if not exists "public"."testimonios" (
  "testimonio_id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "session_id" uuid not null,
  "collaborator_id" uuid,
  "titulo" text not null,
  "testimonio" text not null,
  "experiencia_fecha" date,
  "experiencia_fecha_texto" text,
  "experiencia_ciudad_nombre" text,
  "experiencia_ciudad_geoname_id" bigint,
  "experiencia_pais_nombre" text,
  "experiencia_pais_geoname_id" bigint,
  "experiencia_lugar_texto" text,
  "experiencia_contexto" text,
  "experiencia_rango_edad" text,
  "linked_archive_refs" text[] not null default '{}'::text[],
  "privacy_settings" jsonb not null,
  "privacy_consent" boolean not null,
  "privacy_consent_version" text not null,
  "privacy_consent_at" timestamp with time zone not null default now(),
  "status" text not null default 'nuevo',
  "publicado" boolean not null default false,
  "archivo_objeto_id" text,
  constraint "testimonios_session_id_fkey"
    foreign key ("session_id")
    references "public"."sesiones" ("session_id")
    on delete restrict,
  constraint "testimonios_collaborator_id_fkey"
    foreign key ("collaborator_id")
    references "public"."colaboradores" ("collaborator_id")
    on delete set null,
  constraint "testimonios_titulo_not_blank_check"
    check (length(trim(coalesce("titulo", ''))) > 0),
  constraint "testimonios_testimonio_not_blank_check"
    check (length(trim(coalesce("testimonio", ''))) > 0),
  constraint "testimonios_experiencia_contexto_check"
    check (
      "experiencia_contexto" is null
      or "experiencia_contexto" in ('personal', 'academico', 'profesional', 'otro')
    ),
  constraint "testimonios_experiencia_rango_edad_check"
    check (
      "experiencia_rango_edad" is null
      or "experiencia_rango_edad" in ('menos_de_18', '18_25', '26_35', '36_50', '51_65', 'mas_de_65')
    ),
  constraint "testimonios_experiencia_ciudad_geoname_id_check"
    check ("experiencia_ciudad_geoname_id" is null or "experiencia_ciudad_geoname_id" > 0),
  constraint "testimonios_experiencia_pais_geoname_id_check"
    check ("experiencia_pais_geoname_id" is null or "experiencia_pais_geoname_id" > 0),
  constraint "testimonios_experiencia_lugar_geonames_check"
    check (
      (
        nullif(trim(coalesce("experiencia_ciudad_nombre", '')), '') is null
        and "experiencia_ciudad_geoname_id" is null
        and nullif(trim(coalesce("experiencia_pais_nombre", '')), '') is null
        and "experiencia_pais_geoname_id" is null
        and nullif(trim(coalesce("experiencia_lugar_texto", '')), '') is null
      )
      or
      (
        nullif(trim(coalesce("experiencia_ciudad_nombre", '')), '') is not null
        and "experiencia_ciudad_geoname_id" is not null
        and nullif(trim(coalesce("experiencia_pais_nombre", '')), '') is not null
        and "experiencia_pais_geoname_id" is not null
      )
    ),
  constraint "testimonios_linked_archive_refs_no_empty_check"
    check (
      array_position("linked_archive_refs", '') is null
    ),
  constraint "testimonios_privacy_settings_object_check"
    check (jsonb_typeof("privacy_settings") = 'object'),
  constraint "testimonios_privacy_settings_keys_check"
    check (
      (
        "privacy_settings"
        - 'mostrar_nombre'
        - 'mostrar_ciudad'
        - 'mostrar_pais'
        - 'mostrar_fecha'
        - 'mostrar_rango_edad'
        - 'mostrar_contexto'
        - 'mostrar_lugar_texto'
      ) = '{}'::jsonb
    ),
  constraint "testimonios_privacy_settings_types_check"
    check (
      (not ("privacy_settings" ? 'mostrar_nombre') or jsonb_typeof("privacy_settings" -> 'mostrar_nombre') = 'boolean')
      and (not ("privacy_settings" ? 'mostrar_ciudad') or jsonb_typeof("privacy_settings" -> 'mostrar_ciudad') = 'boolean')
      and (not ("privacy_settings" ? 'mostrar_pais') or jsonb_typeof("privacy_settings" -> 'mostrar_pais') = 'boolean')
      and (not ("privacy_settings" ? 'mostrar_fecha') or jsonb_typeof("privacy_settings" -> 'mostrar_fecha') = 'boolean')
      and (not ("privacy_settings" ? 'mostrar_rango_edad') or jsonb_typeof("privacy_settings" -> 'mostrar_rango_edad') = 'boolean')
      and (not ("privacy_settings" ? 'mostrar_contexto') or jsonb_typeof("privacy_settings" -> 'mostrar_contexto') = 'boolean')
      and (not ("privacy_settings" ? 'mostrar_lugar_texto') or jsonb_typeof("privacy_settings" -> 'mostrar_lugar_texto') = 'boolean')
    ),
  constraint "testimonios_privacy_consent_check"
    check (
      "privacy_consent" = true
      and length(trim(coalesce("privacy_consent_version", ''))) > 0
    ),
  constraint "testimonios_status_check"
    check ("status" in ('nuevo', 'aprobado', 'rechazado')),
  constraint "testimonios_publicado_consistency_check"
    check ((not "publicado") or "status" = 'aprobado')
);

-- ============================================
-- contribuciones_archivo
-- ============================================

create table if not exists "public"."contribuciones_archivo" (
  "contribucion_id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "session_id" uuid not null,
  "collaborator_id" uuid,
  "titulo" text not null,
  "descripcion" text,
  "creadores" jsonb not null default '[]'::jsonb,
  "fecha" date,
  "fecha_texto" text,
  "ciudad_nombre" text,
  "ciudad_geoname_id" bigint,
  "pais_nombre" text,
  "pais_geoname_id" bigint,
  "lugar_texto" text,
  "linked_archive_refs" text[] not null default '{}'::text[],
  "rights_type" text not null,
  "rights_holder" text,
  "drive_file_ids" text[] not null,
  "status" text not null default 'nuevo',
  "collectionbuilder_id" text,
  "privacy_consent" boolean not null,
  "privacy_consent_version" text not null,
  "privacy_consent_at" timestamp with time zone not null default now(),
  constraint "contribuciones_archivo_session_id_fkey"
    foreign key ("session_id")
    references "public"."sesiones" ("session_id")
    on delete restrict,
  constraint "contribuciones_archivo_collaborator_id_fkey"
    foreign key ("collaborator_id")
    references "public"."colaboradores" ("collaborator_id")
    on delete set null,
  constraint "contribuciones_archivo_titulo_not_blank_check"
    check (length(trim(coalesce("titulo", ''))) > 0),
  constraint "contribuciones_archivo_creadores_is_array_check"
    check (jsonb_typeof("creadores") = 'array'),
  constraint "contribuciones_archivo_ciudad_geoname_id_check"
    check ("ciudad_geoname_id" is null or "ciudad_geoname_id" > 0),
  constraint "contribuciones_archivo_pais_geoname_id_check"
    check ("pais_geoname_id" is null or "pais_geoname_id" > 0),
  constraint "contribuciones_archivo_lugar_geonames_check"
    check (
      (
        nullif(trim(coalesce("ciudad_nombre", '')), '') is null
        and "ciudad_geoname_id" is null
        and nullif(trim(coalesce("pais_nombre", '')), '') is null
        and "pais_geoname_id" is null
        and nullif(trim(coalesce("lugar_texto", '')), '') is null
      )
      or
      (
        nullif(trim(coalesce("ciudad_nombre", '')), '') is not null
        and "ciudad_geoname_id" is not null
        and nullif(trim(coalesce("pais_nombre", '')), '') is not null
        and "pais_geoname_id" is not null
      )
    ),
  constraint "contribuciones_archivo_linked_archive_refs_no_empty_check"
    check (array_position("linked_archive_refs", '') is null),
  constraint "contribuciones_archivo_rights_type_check"
    check ("rights_type" in ('cc_by_nc_sa', 'copyright')),
  constraint "contribuciones_archivo_rights_holder_consistency_check"
    check (
      ("rights_type" = 'copyright' and length(trim(coalesce("rights_holder", ''))) > 0)
      or
      ("rights_type" = 'cc_by_nc_sa' and "rights_holder" is null)
    ),
  constraint "contribuciones_archivo_drive_file_ids_check"
    check (
      cardinality("drive_file_ids") >= 1
      and array_position("drive_file_ids", '') is null
    ),
  constraint "contribuciones_archivo_status_check"
    check ("status" in ('nuevo', 'aprobado', 'rechazado')),
  constraint "contribuciones_archivo_privacy_consent_check"
    check (
      "privacy_consent" = true
      and length(trim(coalesce("privacy_consent_version", ''))) > 0
    )
);

-- ============================================
-- vinculos_testimonio_archivo
-- ============================================

create table if not exists "public"."vinculos_testimonio_archivo" (
  "vinculo_id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone not null default now(),
  "testimonio_id" uuid not null,
  "contribucion_id" uuid not null,
  "declared_from" text not null,
  constraint "vinculos_testimonio_archivo_testimonio_id_fkey"
    foreign key ("testimonio_id")
    references "public"."testimonios" ("testimonio_id")
    on delete cascade,
  constraint "vinculos_testimonio_archivo_contribucion_id_fkey"
    foreign key ("contribucion_id")
    references "public"."contribuciones_archivo" ("contribucion_id")
    on delete cascade,
  constraint "vinculos_testimonio_archivo_declared_from_check"
    check ("declared_from" in ('testimonio_form', 'documento_form')),
  constraint "vinculos_testimonio_archivo_unique"
    unique ("testimonio_id", "contribucion_id")
);

-- ============================================
-- indices
-- ============================================

create index if not exists "idx_testimonios_session_id"
  on "public"."testimonios" using btree ("session_id");

create index if not exists "idx_testimonios_collaborator_id"
  on "public"."testimonios" using btree ("collaborator_id");

create index if not exists "idx_testimonios_status"
  on "public"."testimonios" using btree ("status");

create index if not exists "idx_testimonios_status_publicado"
  on "public"."testimonios" using btree ("status", "publicado");

create index if not exists "idx_testimonios_created_at_desc"
  on "public"."testimonios" using btree ("created_at" desc);

create index if not exists "idx_testimonios_experiencia_ciudad_geoname_id"
  on "public"."testimonios" using btree ("experiencia_ciudad_geoname_id");

create index if not exists "idx_testimonios_experiencia_pais_geoname_id"
  on "public"."testimonios" using btree ("experiencia_pais_geoname_id");

create index if not exists "idx_testimonios_linked_archive_refs_gin"
  on "public"."testimonios" using gin ("linked_archive_refs");

create index if not exists "idx_contribuciones_archivo_session_id"
  on "public"."contribuciones_archivo" using btree ("session_id");

create index if not exists "idx_contribuciones_archivo_collaborator_id"
  on "public"."contribuciones_archivo" using btree ("collaborator_id");

create index if not exists "idx_contribuciones_archivo_status"
  on "public"."contribuciones_archivo" using btree ("status");

create index if not exists "idx_contribuciones_archivo_created_at_desc"
  on "public"."contribuciones_archivo" using btree ("created_at" desc);

create index if not exists "idx_contribuciones_archivo_ciudad_geoname_id"
  on "public"."contribuciones_archivo" using btree ("ciudad_geoname_id");

create index if not exists "idx_contribuciones_archivo_pais_geoname_id"
  on "public"."contribuciones_archivo" using btree ("pais_geoname_id");

create index if not exists "idx_contribuciones_archivo_linked_archive_refs_gin"
  on "public"."contribuciones_archivo" using gin ("linked_archive_refs");

create index if not exists "idx_vinculos_testimonio_archivo_contribucion_id"
  on "public"."vinculos_testimonio_archivo" using btree ("contribucion_id");

-- ============================================
-- updated_at triggers
-- ============================================

drop trigger if exists "trg_testimonios_set_updated_at" on "public"."testimonios";

create trigger "trg_testimonios_set_updated_at"
before update on "public"."testimonios"
for each row
execute function "public"."set_updated_at"();

drop trigger if exists "trg_contribuciones_archivo_set_updated_at" on "public"."contribuciones_archivo";

create trigger "trg_contribuciones_archivo_set_updated_at"
before update on "public"."contribuciones_archivo"
for each row
execute function "public"."set_updated_at"();

-- ============================================
-- RLS
-- ============================================

alter table "public"."testimonios" enable row level security;
alter table "public"."contribuciones_archivo" enable row level security;
alter table "public"."vinculos_testimonio_archivo" enable row level security;
