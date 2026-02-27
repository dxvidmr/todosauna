# Replan Maestro v2 (despuÃ©s de F7.2): divisiÃ³n de Fase 8 y roadmap restante

## Resumen
Estado auditado del repo:
1. Fases **0â€“7** estÃ¡n funcionalmente avanzadas: migraciones `00..04`, RPC v2, Edge Functions de upload, formularios `/participa/testimonios/enviar/` y `/participa/documentos/enviar/`, staging + cleanup.
2. Fase **8.1** quedÃ³ funcional (publicaciÃ³n de testimonios en evoluciÃ³n).
3. Fase **8.3** estÃ¡ completada: hardening anti-abuso en evaluaciones aplicado en DB + frontend.
4. Fase **8.2** queda pospuesta hasta congelar campos/UX final de testimonios y formularios.
5. F10.1 completada (QA base E2E local + CI smoke).
6. F10.2 completada (telemetria minima del embudo de lectura).
7. Siguiente bloque activo: **F11 (retirada legacy + consolidacion de configuracion)**.

## Fase 8.1 â€” PublicaciÃ³n de Testimonios (MVP visible)
**Objetivo:** que `/archivo/testimonios/` deje de ser placeholder y lea testimonios publicados.

### Alcance
1. `pages/testimonios.md`: contenedor de listado, estados (`loading/empty/error`) y botÃ³n â€œCargar mÃ¡sâ€.
2. `assets/js/participacion/testimonios-publicos.js` para carga, render y paginaciÃ³n incremental.
3. Include `/_includes/participacion/scripts-testimonios-publicos.html`.
4. Pendiente futuro de automatizaciÃ³n documentado en `planes/testimonios-csv-sync-futuro.md`.

### Criterio de cierre
1. `/archivo/testimonios/` muestra testimonios publicados.
2. No se exponen campos privados.
3. Funciona â€œcargar mÃ¡sâ€ sin recargar.

## Fase 8.2 â€” ModeraciÃ³n operativa + vistas de trabajo (pospuesta)
**Objetivo:** facilitar moderaciÃ³n diaria y paso manual a publicaciÃ³n/archivo sin panel nuevo.

### Alcance
1. MigraciÃ³n SQL `*_06_moderacion_operativa_views.sql` con vistas:
   - `vw_testimonios_moderacion`.
   - `vw_contribuciones_moderacion`.
   - `vw_contribuciones_aprobadas_export_cb`.
2. Documento operativo `docs/moderacion-operativa.md`.
3. AlineaciÃ³n con el plan de cron/autopush futuro en `planes/testimonios-csv-sync-futuro.md`.

### Criterio de cierre
1. ModeraciÃ³n reproducible desde Supabase con consultas/vistas claras.
2. ExportaciÃ³n de contribuciones aprobadas a CSV documentada.

## Fase 8.3 â€” Hardening anti-abuso en evaluaciones (RF-020) [completada]
**Objetivo:** aplicar lÃ­mites tambiÃ©n a lectura/laboratorio (`rpc_submit_participation_event`).

### Alcance ejecutado
1. MigraciÃ³n SQL `*_05_rate_limit_evaluaciones.sql`:
   - check de `participacion_rate_limit_events.action` incluye `submit_evaluacion`.
   - `_assert_rate_limit` aplicado en `rpc_submit_participation_event`.
   - registro de eventos de rate limit tras inserciÃ³n exitosa.
2. Ajuste frontend en lectura/laboratorio/sugerencias:
   - mensaje explÃ­cito cuando el backend devuelve lÃ­mite alcanzado.

### Criterio de cierre
1. Excesos bloqueados por sesiÃ³n e IP hash.
2. UX mantiene feedback claro sin romper flujo normal.

## Fase 9 â€” Calidad de texto/UX y robustez frontend
**Objetivo:** limpiar deuda visible antes de retirar legacy.

### Subfases
1. **F9.1 (completada):** corregido mojibake/UTF-8 en UI pÃºblica crÃ­tica.
2. **F9.2 (completada):** reemplazo de `alert/confirm` por UX consistente (RF-017).
3. **F9.3 (completada):** guardas anti doble submit/carrera (RF-018).
4. **F9.4 (completada):** normalizaciÃ³n de mensajes por cÃ³digos RPC (RF-004).

### Criterio de cierre de fase
1. UI pÃºblica sin textos corruptos.
2. No quedan `alert/confirm` en participaciÃ³n.
3. Sin doble envÃ­o por clicks repetidos.

## Fase 10 â€” QA automatizada + observabilidad mÃ­nima
**Objetivo:** reducir regresiones y medir embudo bÃ¡sico.

### Alcance
1. **F10.1 (completada):** E2E smoke (Playwright) para:
   - bootstrap sesiÃ³n global.
   - lectura: primera libre / segunda con modal.
   - testimonio + contribuciÃ³n + vÃ­nculo cruzado.
   - upload staged feliz.
2. **F10.2 (completada):** Telemetria minima embudo lectura (RF-016):
   - evento 1.Âª contribuciÃ³n.
   - apertura modal 2.Âª.
   - elecciÃ³n anÃ³nimo/colaborador.
   - abandono.

### Criterio de cierre
1. Suite automÃ¡tica ejecutable en local/CI.
2. MÃ©tricas mÃ­nimas para decisiones de UX.

## Fase 11 â€” Retirada legacy + consolidaciÃ³n de configuraciÃ³n
**Objetivo:** cerrar transiciÃ³n tÃ©cnica de Fase 4.

### Alcance
1. Eliminar puente legacy y wrappers:
   - `assets/js/participacion/legacy-bridge.js`
   - `assets/js/lectura/user-manager.js`
   - `assets/js/lectura/modal-modo.js`
2. Migrar llamadas restantes de lectura/laboratorio a `window.Participacion.*`.
3. Consolidar configuraciÃ³n Supabase/runtime (RF-006, RF-022).

### Criterio de cierre
1. No hay dependencias de APIs JS legacy.
2. ConfiguraciÃ³n centralizada y documentada.

## Fase 12 â€” Cierre operativo y documentaciÃ³n final
**Objetivo:** dejar el sistema mantenible para operaciÃ³n continua.

### Alcance
1. `docs/migraciones-playbook.md`.
2. `docs/rotacion-secretos.md`.
3. `docs/incidencias-upload-cleanup.md`.
4. Alertas operativas para limpieza staging (RF-025).

### Criterio de cierre
1. Mantenimiento crÃ­tico con runbooks verificables.
2. Incidencias de upload/cleanup detectables y trazables.

## Cambios en APIs / interfaces / tipos pÃºblicos (pendientes)
1. **Fase 8.2:** nuevas vistas SQL operativas para moderaciÃ³n/export.
2. **Fase 10:** QA automatizada + telemetria minima (incluye tabla y RPC de funnel).
3. **Fase 11:** deprecaciÃ³n definitiva de interfaces JS legacy globales.

## Matriz de pruebas (mÃ­nima por fase)
1. F9.1: ausencia de mojibake en lectura/laboratorio.
2. F9.2: eliminaciÃ³n de `alert/confirm` con UX equivalente.
3. F9.3: no hay doble submit por clicks repetidos.
4. F9.4: errores homogÃ©neos por cÃ³digo RPC.
5. F10: suite e2e verde en escenarios crÃ­ticos.
6. F11: lectura/laboratorio funcionando sin bridge legacy.
7. F8.2: consultas de moderaciÃ³n y export CSV reproducible.
8. F12: runbooks verificables por un tercero.

## Supuestos y defaults
1. ModeraciÃ³n manual en Supabase (sin panel admin dedicado).
2. `/archivo/documentos/` sigue basado en CSV/CollectionBuilder.
3. Priorizacion vigente: **11 -> 8.2 -> 12**.
4. Sin breaking changes de backend pÃºblico hasta validar cada bloque.



