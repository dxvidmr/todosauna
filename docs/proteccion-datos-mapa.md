# Mapa de protección de datos (foto técnica actual)

Última revisión técnica: 2026-03-11  
Proyecto: Todos a una

Este documento describe qué datos se registran realmente en el sistema, cuándo se registran y qué puede ver o recuperar una persona usuaria desde la web actual.

## Principio operativo actual

- Las visitas sin participación no crean filas en `public.sesiones` ni en otras tablas de participación.
- La sesión de Supabase se crea solo cuando hay una acción de participación con escritura real (evaluación, sugerencia, envío de testimonio, subida/envío de documento, registro/login colaborador).
- La navegación general de visitas debe medirse con analítica web (por ejemplo, Google Analytics), fuera de Supabase.

## Matriz única de tratamiento de datos

| Flujo / actor | Qué datos se registran exactamente | Dónde se guardan | Cuándo se registran | Para qué se usan | Qué puede recuperar/ver la persona usuaria desde la web | Qué no es recuperable desde la web actual | Qué queda visible públicamente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Visita pasiva (sin participación) | No se registra `session_id` en Supabase. En navegador se mantiene estado técnico local: `browser_session_token` y `mode_choice` para continuidad UX entre pestañas. | Navegador (`cookie` de sesión + `localStorage` + `sessionStorage` legacy). | Al cargar scripts de participación, sin enviar nada al backend. | Compartir estado entre pestañas y preparar UX sin crear registro server-side. | Solo efectos de UX local (estado de modo/gates en la sesión de navegador). | No hay fila de sesión en Supabase que consultar/exportar. | Nada. |
| Alta de sesión de participación (primer write real) | `session_id`, `browser_session_token`, `modo_participacion` inicial, timestamps de sesión. | `public.sesiones` (Supabase). | En el primer envío real que requiere escritura. | Vincular eventos de participación a una sesión técnica. | Estado de sesión/mode en UI y perfil de participación de la sesión actual. | No hay descarga de fila cruda desde UI pública. | Nada. |
| Evaluación de nota / sugerencia de falta de nota | `session_id`, `source`, `event_type`, `nota_id`/`target_xmlid`, `vote`, `comment` opcional, timestamp; además eventos anti-flood con `ip_hash`. | `public.evaluaciones` + `public.participacion_rate_limit_events`. | En cada envío de evaluación/sugerencia. | Mejora editorial, métricas agregadas y control anti-abuso. | Feedback inmediato en UI, estado 'nota evaluada', y contadores agregados de su sesión. | No acceso a filas crudas ni a `ip_hash`. | Solo agregados (conteos/estadísticas), no datos personales crudos. |
| Registro/login colaborador | `email_hash` (SHA-256), `display_name` opcional, `nivel_estudios` opcional, `disciplina` opcional, vínculo a sesión (`collaborator_id`). | `public.colaboradores` + `public.sesiones`. | Al registrarse o identificarse como colaborador/a. | Permitir atribución y recuperación de contribuciones sin guardar email en claro. | Puede volver a identificarse con el mismo email (comparación por hash) y ver su modo/perfil. | Email en claro y contraseña (no se almacenan). | No se publica `email_hash`. |
| Envío de testimonio (anónimo o colaborador) | `session_id`, `collaborator_id` opcional, texto y metadatos de experiencia, `privacy_settings`, consentimiento (`privacy_consent`, versión y fecha). | `public.testimonios` + `public.participacion_rate_limit_events`. | Al enviar formulario de testimonio. | Recepción, moderación y eventual publicación controlada. | Confirmación de envío, ID generado y contadores agregados en perfil de sesión. | No acceso a fila completa ni a trazas anti-flood. | Solo testimonios aprobados/exportados y filtrados por `privacy_settings`. |
| Envío de documento (anónimo o colaborador) | `session_id`, `collaborator_id` opcional, metadatos documentales, derechos, consentimiento, y relación con archivos subidos (`drive_file_ids`). | `public.contribuciones_archivo` + `public.participacion_rate_limit_events`. | Al confirmar envío final del formulario de documento. | Ingesta y revisión de aportaciones documentales. | Confirmación de envío, ID generado y contadores agregados en perfil de sesión. | No acceso a tabla cruda ni historial detallado desde UI pública. | No publicación directa en frontend público actual. |
| Pipeline de subida de archivos (previo al envío de documento) | `staging_id`, `session_id`, estado, manifiesto de ficheros, metadatos técnicos, recibos firmados, intentos de limpieza. | `public.contribuciones_upload_staging` + Google Drive (binario vía Apps Script). | Durante el proceso de subida y validación previa al envío final. | Seguridad, integridad, cancelación y trazabilidad técnica de subida. | En formulario: lista de archivos subidos en la sesión actual. | No acceso a internals completos de staging ni a logs de Apps Script. | Nada. |
| Telemetría mínima de embudo (participación) | `session_id`, `event_name`, `context`, `metadata`, `created_at` (deduplicación por sesión/evento). | `public.participacion_funnel_events` + dedupe local en navegador. | Solo cuando existe `session_id` activo y se dispara evento de embudo. | Medir fricción/conversión del flujo de participación. | No hay panel de usuario para estos eventos. | No acceso a eventos ni metadata cruda desde UI pública. | Nada. |
| Analítica de visitas (sin participación) | Métricas de visita, navegación y rendimiento del sitio (sin usar tablas de participación de Supabase). | Plataforma de analítica web externa (p. ej. Google Analytics). | En navegación general del sitio. | Medición de tráfico sin inflar base de datos de participación. | Métricas agregadas en panel de analítica (equipo del proyecto). | No aplica como historial personal en la web pública del proyecto. | No se publica identificación personal de visitantes. |

## Recuperable vs no recuperable (estado actual)

### Recuperable desde la web por la persona usuaria

- Estado de modo de participación en la sesión de navegador activa.
- Confirmaciones e identificadores de envíos realizados en el flujo actual.
- Contadores agregados de contribuciones de su sesión/perfil.
- Reidentificación como colaborador/a con el mismo email (vía hash).

### No recuperable desde la web por la persona usuaria

- Email en claro.
- IP en claro (`ip_hash` solo para anti-flood).
- Filas crudas de tablas internas (`sesiones`, `evaluaciones`, `rate_limit`, `funnel`, staging completo).
- Historial completo multi-sesión con exportación íntegra desde la UI pública actual.
