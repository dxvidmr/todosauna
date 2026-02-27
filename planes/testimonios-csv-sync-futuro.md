# Sync futuro de testimonios CSV (cron auto-push)

## Estado actual
- **No implementado** en esta fase.
- Publicacion de testimonios en web: **manual** (export SQL -> `assets/data/testimonios-export.csv` -> commit).
- Cola de exportacion actual: `status='aprobado'` + `exported_at is null`.

## Export manual actual (operativa vigente)
1. Abrir SQL Editor en Supabase.
2. Ejecutar esta query de exportacion:

```sql
select *
from public.vw_testimonios_aprobados_pendientes_export
order by created_at desc;
```

3. Exportar resultado a CSV.
4. Guardar el archivo en `assets/data/testimonios-export.csv`.
5. Marcar exportados en DB:

```sql
update public.testimonios
set exported_at = now()
where testimonio_id in (
  '<uuid_1>',
  '<uuid_2>'
);
```

6. Commit y push del CSV junto con el resto de cambios editoriales.

## Objetivo futuro
Automatizar la actualizacion del CSV publico de testimonios aprobados pendientes de export, manteniendo:
- privacidad ya filtrada en SQL,
- trazabilidad de cambios en Git,
- despliegue automatico del sitio estatico tras push.

## Arquitectura propuesta
1. Workflow en GitHub Actions programado (cron) y ejecutable bajo demanda.
2. Job que consulta Supabase con `service_role` (solo lectura de vista de exportacion).
3. Generacion de `assets/data/testimonios-export.csv`.
4. Commit automatico si hay cambios reales y push a rama principal.
5. El despliegue habitual de la web publica el nuevo snapshot.

## Secrets y seguridad
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- (opcional) `SYNC_COMMIT_AUTHOR_NAME`
- (opcional) `SYNC_COMMIT_AUTHOR_EMAIL`

Reglas:
1. No exponer secretos en `_config.yml` ni en frontend.
2. Limitar permisos del token del workflow (`contents: write` solo para el repo objetivo).
3. Query de exportacion con filtrado estricto (`status='aprobado'` y `exported_at is null`) y campos anonimizados por `privacy_settings`.

## Flujo sugerido del cron
1. Checkout repo.
2. Ejecutar script de exportacion (`scripts/export-testimonios-csv.mjs` o equivalente).
3. Validar cabeceras esperadas del CSV.
4. Verificar diff:
   - si no hay cambios: terminar sin commit.
   - si hay cambios: commit con mensaje estandar y push.
5. Reportar en logs metricas basicas (numero de filas exportadas y hash de salida).

## Criterios para activarlo en produccion
1. Moderacion estable (equipo y flujo diario definidos).
2. Query de exportacion validada legalmente para privacidad.
3. Observabilidad minima en workflow (fallos notificables).
4. Politica de rollback documentada (revert de commit CSV).

## Riesgos y mitigaciones
- Riesgo: publicar datos no deseados por query mal construida.
  - Mitigacion: tests de contrato de columnas + revision de muestra previa al primer despliegue.
- Riesgo: commits ruidosos sin cambios reales.
  - Mitigacion: commit condicionado a diff real.
- Riesgo: caida temporal de Supabase durante cron.
  - Mitigacion: retry controlado y no sobrescribir CSV si falla export.
