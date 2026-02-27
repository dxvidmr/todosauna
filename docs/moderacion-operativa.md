# Moderacion operativa (F8.2)

Este documento define el flujo diario de moderacion y export manual sin panel admin dedicado.

## Objetivo

1. Revisar testimonios y contribuciones pendientes desde vistas SQL.
2. Aprobar/rechazar con criterio consistente.
3. Exportar testimonios y contribuciones aprobadas a CSV.

## Precondiciones

1. Tienes acceso al proyecto Supabase con permisos para ejecutar SQL.
2. El esquema de participacion y las migraciones `*_07`, `*_08` y `*_09` estan aplicadas.
3. Moderacion sigue siendo manual (no hay automatizacion de cambios de estado).

## Vistas operativas

1. `public.vw_testimonios_moderacion`
2. `public.vw_testimonios_aprobados_pendientes_export`
3. `public.vw_contribuciones_moderacion`
4. `public.vw_contribuciones_aprobadas_export_cb`

## Flujo de testimonios

### 1) Bandeja de pendientes de moderacion

```sql
select *
from public.vw_testimonios_moderacion
order by created_at asc;
```

### 2) Decidir estado

Estados validos:
1. `nuevo` (pendiente)
2. `aprobado`
3. `rechazado`

### 3) Aprobar

```sql
update public.testimonios
set status = 'aprobado'
where testimonio_id = '<uuid_testimonio>';
```

### 4) Rechazar

```sql
update public.testimonios
set status = 'rechazado'
where testimonio_id = '<uuid_testimonio>';
```

### 5) Cola de export de testimonios

`vw_testimonios_aprobados_pendientes_export` solo incluye:
1. `status='aprobado'`
2. `exported_at is null`

```sql
select *
from public.vw_testimonios_aprobados_pendientes_export
order by created_at asc;
```

### 6) Marcar exportados (manual)

Despues de exportar CSV, puedes marcar con `now()` o una fecha manual.

Con `now()`:

```sql
update public.testimonios
set exported_at = now()
where testimonio_id in (
  '<uuid_1>',
  '<uuid_2>'
);
```

Con fecha manual:

```sql
update public.testimonios
set exported_at = '2026-02-27 18:30:00+00'
where testimonio_id = '<uuid_testimonio>';
```

### 7) Reexportar un testimonio

Si necesitas reexportar tras cambios, resetea `exported_at` a `null`.

```sql
update public.testimonios
set exported_at = null
where testimonio_id = '<uuid_testimonio>';
```

## Flujo de contribuciones documentales

### 1) Bandeja de pendientes

```sql
select *
from public.vw_contribuciones_moderacion
order by created_at asc;
```

Campos clave de revision:
1. `rights_type`, `rights_holder`
2. `drive_file_count`, `drive_file_ids`
3. `linked_archive_refs`, `linked_testimonios_count`

### 2) Aprobar

```sql
update public.contribuciones_archivo
set status = 'aprobado'
where contribucion_id = '<uuid_contribucion>';
```

### 3) Rechazar

```sql
update public.contribuciones_archivo
set status = 'rechazado'
where contribucion_id = '<uuid_contribucion>';
```

## Export CSV a CollectionBuilder

La vista `vw_contribuciones_aprobadas_export_cb` prepara columnas compatibles con el CSV de CollectionBuilder y agrega columnas operativas extra.

### 1) Ver aprobadas listas para export

```sql
select *
from public.vw_contribuciones_aprobadas_export_cb
where is_pending_collectionbuilder_export = true
order by created_at asc;
```

### 2) Exportar desde SQL Editor

1. Ejecuta la query anterior.
2. Usa `Download CSV`.
3. Revisa columnas requeridas por tu pipeline CB.
4. Integra filas en el CSV canonico del repositorio (`_data/CB-Fuenteovejuna-metadata.csv` o flujo equivalente).

### 3) Marcar en CollectionBuilder

Cuando una contribucion ya esta incorporada al CSV/catalogo final, guarda su ID publico:

```sql
update public.contribuciones_archivo
set collectionbuilder_id = '<objectid_cb>'
where contribucion_id = '<uuid_contribucion>';
```

## Checklist diario recomendado

1. Revisar `vw_testimonios_moderacion`.
2. Aplicar `aprobado/rechazado` en testimonios.
3. Exportar pendientes de testimonios con `vw_testimonios_aprobados_pendientes_export`.
4. Marcar `exported_at` manualmente para los testimonios exportados.
5. Revisar `vw_contribuciones_moderacion`.
6. Aplicar `aprobado/rechazado` en contribuciones.
7. Exportar aprobadas pendientes con `vw_contribuciones_aprobadas_export_cb`.
8. Commit del CSV y despliegue del sitio.

## Notas de evolucion (importante)

1. Si cambian campos o terminos permitidos (CHECK/enums), ajustar vistas con `create or replace view`.
2. El control de cola de testimonios se gestiona con `exported_at`.
3. Para automatizacion futura de testimonios CSV, ver `planes/testimonios-csv-sync-futuro.md`.
