# Replan Maestro v2 (actualizado)

## Resumen de estado

1. Fases funcionales 0-11 cerradas en practica.
2. Migraciones local/remoto sincronizadas hasta `20260227190000`.
3. Workflows operativos activos:
   - `.github/workflows/e2e-smoke.yml`
   - `.github/workflows/cleanup-stale-uploads.yml`
4. Bloque actual: **F12 (cierre operativo)**.
5. Bloque siguiente: **F13 (RF funcionales/arquitectura)**.

## F12 - Cierre operativo y documentacion final

## F12.1 Runbooks operativos [completada]

Entregables:

1. `docs/migraciones-playbook.md`
2. `docs/rotacion-secretos.md`
3. `docs/incidencias-upload-cleanup.md`

## F12.2 Alertas operativas cleanup (RF-025) [completada]

Entregables:

1. `cleanup-stale-uploads.yml` parsea metricas del JSON de respuesta.
2. El job falla si:
   - `metrics.cleanup_failed > CLEANUP_FAIL_THRESHOLD`
   - `metrics.failed > CLEANUP_FAIL_THRESHOLD`
3. Resumen con metricas clave en `GITHUB_STEP_SUMMARY`.

Default:

1. `CLEANUP_FAIL_THRESHOLD=0`

## F12.3 Cierre operativo upload pipeline (RF-023) [en progreso]

Pendiente para cerrar:

1. Evidencia manual documentada de exito:
   - `issue token -> upload -> finalize -> submit`
2. Evidencia manual documentada de cancelacion.
3. Evidencia manual documentada de cleanup de huerfanos.

Base operativa ya actualizada en:

1. `docs/apps-script-upload-contract.md`
2. `docs/incidencias-upload-cleanup.md`

## F12.4 Consistencia de planes [completada]

1. Roadmap alineado con estado real.
2. Backlog pendiente concentrado en F13.

## F13 - Siguiente ciclo

Orden de ejecucion:

1. F13.1 RF-015 (gate de segunda contribucion en backend)
2. F13.2 RF-024 (borrado/reintento individual de archivo en staging)
3. F13.3 RF-003 (separar template del modal de participacion)
4. F13.4 RF-001 (migracion a ES Modules en runtime)

## Backlog abierto (vivo)

1. RF-001 pendiente
2. RF-003 pendiente
3. RF-015 pendiente
4. RF-023 en progreso
5. RF-024 pendiente
6. RF-025 completado
