# Sync futuro de testimonios CSV (cron auto-push)

## Estado actual
- **No implementado** en esta fase.
- Publicación de testimonios en web: **manual** (export SQL -> `assets/data/testimonios-publicados.csv` -> commit).

## Export manual actual (operativa vigente)
1. Abrir SQL Editor en Supabase.
2. Ejecutar esta query de exportación:

```sql
select
  t.testimonio_id,
  t.created_at,
  t.titulo,
  t.testimonio,
  case when coalesce((t.privacy_settings ->> 'mostrar_fecha')::boolean, false) then t.experiencia_fecha::text else '' end as experiencia_fecha,
  case when coalesce((t.privacy_settings ->> 'mostrar_fecha')::boolean, false) then coalesce(t.experiencia_fecha_texto, '') else '' end as experiencia_fecha_texto,
  case when coalesce((t.privacy_settings ->> 'mostrar_ciudad')::boolean, false) then coalesce(t.experiencia_ciudad_nombre, '') else '' end as experiencia_ciudad_nombre,
  case when coalesce((t.privacy_settings ->> 'mostrar_pais')::boolean, false) then coalesce(t.experiencia_pais_nombre, '') else '' end as experiencia_pais_nombre,
  case when coalesce((t.privacy_settings ->> 'mostrar_lugar_texto')::boolean, false) then coalesce(t.experiencia_lugar_texto, '') else '' end as experiencia_lugar_texto,
  case when coalesce((t.privacy_settings ->> 'mostrar_contexto')::boolean, false) then coalesce(t.experiencia_contexto, '') else '' end as experiencia_contexto,
  case when coalesce((t.privacy_settings ->> 'mostrar_rango_edad')::boolean, false) then coalesce(t.experiencia_rango_edad, '') else '' end as experiencia_rango_edad,
  case when coalesce((t.privacy_settings ->> 'mostrar_nombre')::boolean, false) then coalesce(c.display_name, '') else '' end as display_name,
  coalesce(to_json(t.linked_archive_refs)::text, '[]') as linked_archive_refs
from public.testimonios t
left join public.colaboradores c on c.collaborator_id = t.collaborator_id
where t.status = 'aprobado'
  and t.publicado = true
order by t.created_at desc;
```

3. Exportar resultado a CSV.
4. Guardar el archivo en `assets/data/testimonios-publicados.csv`.
5. Commit y push del CSV junto con el resto de cambios editoriales.

## Objetivo futuro
Automatizar la actualización del CSV público de testimonios aprobados/publicados, manteniendo:
- privacidad ya filtrada en SQL,
- trazabilidad de cambios en Git,
- despliegue automático del sitio estático tras push.

## Arquitectura propuesta
1. Workflow en GitHub Actions programado (cron) y ejecutable bajo demanda.
2. Job que consulta Supabase con `service_role` (solo lectura de la vista/query pública filtrada).
3. Generación de `assets/data/testimonios-publicados.csv`.
4. Commit automático si hay cambios reales y push a rama principal.
5. El despliegue habitual de la web publica el nuevo snapshot.

## Secrets y seguridad
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- (opcional) `SYNC_COMMIT_AUTHOR_NAME`
- (opcional) `SYNC_COMMIT_AUTHOR_EMAIL`

Reglas:
1. No exponer secretos en `_config.yml` ni en frontend.
2. Limitar permisos del token del workflow (`contents: write` solo para el repo objetivo).
3. Query de exportación con filtrado estricto (`status='aprobado'` y `publicado=true`) y campos ya anonimizados por `privacy_settings`.

## Flujo sugerido del cron
1. Checkout repo.
2. Ejecutar script de exportación (`scripts/export-testimonios-csv.mjs` o equivalente).
3. Validar cabeceras esperadas del CSV.
4. Verificar diff:
   - si no hay cambios: terminar sin commit.
   - si hay cambios: commit con mensaje estándar y push.
5. Reportar en logs métricas básicas (número de filas exportadas y hash de salida).

## Criterios para activarlo en producción
1. Moderación estable (equipo y flujo diario definidos).
2. Query de exportación validada legalmente para privacidad.
3. Observabilidad mínima en workflow (fallos notificables).
4. Política de rollback documentada (revert de commit CSV).

## Riesgos y mitigaciones
- Riesgo: publicar datos no deseados por query mal construida.
  - Mitigación: tests de contrato de columnas + revisión de muestra previa al primer despliegue.
- Riesgo: commits ruidosos sin cambios reales.
  - Mitigación: commit condicionado a diff real.
- Riesgo: caída temporal de Supabase durante cron.
  - Mitigación: retry controlado y no sobrescribir CSV si falla export.
