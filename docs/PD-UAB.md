# Registro de Actividades de Tratamiento y Evaluación de Impacto Simplificada

Proyecto: Todos a una - Plataforma digital de edición social de *Fuenteovejuna* 
Responsable del tratamiento: David Merino Recalde  
Directores: Ramón Valdés Gázquez (Universitat Autònoma de Barcelona) y Susanna Allès Torrent (University of Miami)  
Departamento: Filología Española, Universitat Autònoma de Barcelona  
Contacto: david.merino@uab.cat  
Última revisión: 2026-03-13

## 1. Descripción del proyecto y finalidad del tratamiento

Todos a una es un proyecto académico en humanidades digitales dedicado a la investigación y proyección pública de *Fuenteovejuna*. El portal funciona como un entorno de trabajo y transferencia del conocimiento, en el que convergen investigación, participación social y difusión cultural. Los datos se recogen con las siguientes finalidades:

- Investigación científica: análisis de la recepción lectora y la utilidad de las notas de edición (art. 89 RGPD).
- Mejora editorial: evaluación colaborativa de notas filológicas por parte de personas lectoras especializadas y no especializadas.
- Archivo histórico: recepción y custodia de documentos y testimonios relacionados con la obra.
- Difusión y acceso a objetos digitales de archivo: enlace a recursos externos cuando existen, o publicación en el DDD de la UAB cuando no existe copia pública externa.
- Funcionamiento técnico: control antiabuso, integridad de subidas y telemetría del flujo de participación.

El proyecto tiene vocación de continuidad más allá de la defensa de la tesis doctoral, prevista para finales del curso 2026-2027 o principios del siguiente.

## 2. Responsable e identificación

| Campo | Valor |
| --- | --- |
| Responsable | David Merino Recalde |
| Institución | Universitat Autònoma de Barcelona |
| Departamento | Filología Española |
| Marco | Tesis doctoral en curso |
| Directores | Ramón Valdés Gázquez (UAB) y Susanna Allès Torrent (University of Miami) |
| Contacto para ejercicio de derechos | david.merino@uab.cat |
| Autoridad de control competente | Agència de Protecció de Dades de Catalunya (APDCAT) - https://apdcat.cat |

## 3. Base jurídica por flujo de tratamiento

| Flujo | Base jurídica RGPD | Observaciones |
| --- | --- | --- |
| Evaluaciones anónimas de notas | Art. 6.1.f (interés legítimo) + art. 89.1 (investigación científica) | No se recogen datos personales directos; `session_id` es un UUID técnico sin vinculación a identidad real. |
| Sugerencia de falta de nota | Art. 6.1.f + art. 89.1 | Mismo encaje que evaluaciones. |
| Registro de colaborador | Art. 6.1.a (consentimiento explícito) | Checkbox obligatorio; consentimiento versionado y fechado. Puede incluir campos opcionales de perfil (año de nacimiento, ubicación GeoNames y relación con la obra). |
| Login de colaborador recurrente | Art. 6.1.f (interés legítimo) | Reidentificación técnica por hash; no se almacena email en claro. |
| Envío de testimonio | Art. 6.1.a (consentimiento explícito) | Consentimiento explícito en formulario; `privacy_settings` configurados por la persona usuaria. |
| Envío de documento/archivo | Art. 6.1.a (consentimiento explícito) | Incluye aceptación de condiciones y derechos de uso del material aportado. |
| Control antiabuso (`ip_hash`) | Art. 6.1.f (interés legítimo en seguridad) | IP no almacenada en claro; uso restringido a prevención de abuso. |
| Telemetría de embudo de participación | Art. 6.1.f + art. 89.1 | Solo datos técnicos de evento ligados a sesión. |
| Analítica de visitas (Google Analytics, previsto) | Art. 6.1.f (interés legítimo) con minimización | Prevista anonimizando IP e informada en política pública. |

## 4. Matriz de tratamiento de datos

Documento técnico de referencia: [Mapa de protección de datos](./proteccion-datos-mapa.md).

### 4.1 Tablas activas en Supabase

| Tabla | Datos personales o pseudónimos | Retención prevista |
| --- | --- | --- |
| `public.sesiones` | `session_id` (UUID), `browser_session_token`, `modo_participacion`, timestamps | Duración del proyecto + 5 años tras defensa |
| `public.evaluaciones` | `session_id`, `source`, `event_type`, `nota_id`/`target_xmlid`, `vote`, `comment` opcional, timestamp | Duración del proyecto + 5 años tras defensa |
| `public.participacion_rate_limit_events` | `session_id`, `ip_hash`, `action`, `created_at` | Retención operativa prevista: 90 días |
| `public.colaboradores` | `email_hash` (SHA-256), consentimiento RGPD (`consent_rgpd`, versión, fecha), `display_name` opcional, `nivel_estudios` opcional, `disciplina` opcional, `anio_nacimiento` opcional, `city_name/city_geoname_id` opcional, `country_name/country_geoname_id` opcional, `relacion_obra` opcional (`text[]`) | Hasta solicitud de supresión o fin del proyecto + 5 años |
| `public.testimonios` | `session_id`, `collaborator_id` opcional, texto, `privacy_settings`, consentimiento versionado | Testimonios aprobados: conservación histórica; resto: duración del proyecto + 5 años |
| `public.contribuciones_archivo` | `session_id`, `collaborator_id` opcional, metadatos documentales, consentimiento versionado | Conservación histórica del archivo |
| `public.contribuciones_upload_staging` | `staging_id`, `session_id`, manifiesto técnico de subida | 30 días tras envío completado o cancelado |
| `public.participacion_funnel_events` | `session_id`, nombre de evento, contexto y metadatos técnicos | Duración del proyecto + 5 años tras defensa |

### 4.2 Almacenamiento fuera de Supabase

| Dato | Dónde | Retención |
| --- | --- | --- |
| Archivos binarios de documentos aportados | Google Drive (cuenta del proyecto, vía Apps Script) | Conservación histórica del archivo |
| Objetos digitales publicados y sus enlaces de acceso | DDD de la UAB (si no existe objeto externo) o repositorio/sitio externo de referencia (si ya existe) | Según política del DDD/UAB o disponibilidad del repositorio externo |
| Métricas de visitas web (previsto) | Google Analytics | Según configuración de retención de GA (recomendado: hasta 26 meses) |

### 4.3 Principio operativo actual

- Las visitas sin participación no crean registros en Supabase.
- El estado de participación vive en `sessionStorage` y se sincroniza entre pestañas abiertas.
- Al cerrar todas las pestañas, el estado local se pierde.
- La sesión en Supabase se crea solo en el primer acto de participación real (evaluación, sugerencia, envío de formulario, registro o login de colaborador).

### 4.4 Flujo de publicación de objetos digitales del archivo

1. Si el objeto digital ya existe en un repositorio o sitio externo fiable, la web conserva y muestra ese enlace externo como vía de acceso.
2. Si no existe objeto digital público externo, el material recibido por formulario (incluidos ficheros subidos vía Google Drive) se prepara y se publica primero en el DDD de la UAB.
3. Una vez publicado en el DDD, la web enlaza ese objeto digital como referencia pública estable.
4. Google Drive se usa como canal de ingesta y trabajo interno, no como repositorio público final de consulta.

## 5. Encargados del tratamiento y transferencias internacionales

| Encargado | Servicio | Ubicación de datos | Base de transferencia |
| --- | --- | --- | --- |
| Supabase Inc. | Base de datos relacional (`public.*`) | Región UE del proyecto (entorno actual: Francia) | Sin transferencia internacional cuando el despliegue está en la UE |
| Universitat Autònoma de Barcelona (DDD) | Publicación y preservación de objetos digitales del archivo | España (UE) | Sin transferencia internacional (servicio institucional en la UE) |
| Google LLC | Almacenamiento de binarios (Google Drive vía Apps Script) | Puede implicar procesamiento fuera de la UE | Cláusulas Contractuales Tipo (SCCs) conforme a la Decisión (UE) 2021/914 |
| Google LLC | Analítica de visitas (Google Analytics, previsto) | Puede implicar EE. UU. | SCCs + medidas de minimización (p. ej., anonimización de IP) |

## 6. Derechos de las personas interesadas y mecanismo de ejercicio

Las personas interesadas pueden ejercer sus derechos de acceso, rectificación, supresión, limitación y portabilidad contactando al responsable en `david.merino@uab.cat`. El plazo de respuesta es de un mes desde la recepción de la solicitud (art. 12 RGPD).

### 6.1 Verificación de identidad

El email de colaboradores se almacena como hash SHA-256. Para verificar la titularidad de una solicitud, el responsable solicitará el email original y comprobará coincidencia de hash.

### 6.2 Supresión de perfil de colaborador

La supresión debe ejecutarse preservando la coherencia técnica del sistema:

- Desvinculación previa de la sesión (`modo_participacion = anonimo`, `collaborator_id = null`).
- Eliminación o anonimización del perfil en `public.colaboradores`.
- Conservación de contribuciones cuando proceda, sin identificación directa del colaborador.

### 6.3 Canal y reclamación

- Canal de ejercicio: contacto directo con el responsable (`david.merino@uab.cat`).
- No existe actualmente un panel automatizado de supresión en la web pública.
- Autoridad de control: APDCAT (`https://apdcat.cat`).

## 7. Medidas de seguridad técnicas

| Medida | Descripción |
| --- | --- |
| Seudonimización de sesiones | `session_id` UUID v4, sin identificación directa de la persona usuaria |
| Hash de email | SHA-256 con normalización (`trim` + `lowercase`) |
| Hash de IP | SHA-256 para antiabuso; no se guarda la IP en claro |
| RLS | Row Level Security activado en tablas de participación |
| Consentimiento versionado | Formularios de registro/testimonio/documento registran versión y fecha de aceptación |
| Restricción de acceso a archivos | Los archivos en Drive no son públicos por defecto |
| Limpieza de staging | Eliminación de subidas no confirmadas según política operativa |
| Sin contraseñas | No se almacenan ni gestionan contraseñas |

## 8. Plazos de conservación y justificación

- Datos de participación (`sesiones`, `evaluaciones`, `funnel`, `colaboradores`): vigencia del proyecto + 5 tras su finalización, conforme al principio de limitación temporal (art. 5.1.e RGPD).
- Datos de archivo histórico (`testimonios` aprobados y `contribuciones_archivo`): conservación histórica vinculada al corpus del proyecto.
- Objetos digitales publicados en DDD: conservación y acceso conforme a la política institucional del DDD/UAB.
- Enlaces externos a objetos ya publicados en terceros: se mantienen mientras el recurso externo permanezca disponible.
- Datos antiabuso (`participacion_rate_limit_events`): objetivo operativo de 90 días.
- Staging de subidas: 30 días tras envío completado o cancelado.
- Google Analytics (previsto): retención máxima recomendada de 26 meses.

## 9. Decisiones de diseño justificadas

### 9.1 Hash de email frente a email en claro

Se almacena únicamente `email_hash` para minimizar riesgo y superficie de datos personales (art. 5.1.c RGPD). El ejercicio de derechos se gestiona mediante verificación por hash.

### 9.2 Canal manual de ejercicio de derechos

Dado el volumen esperado, se opta por canal de contacto directo en lugar de automatización en interfaz. Esta decisión puede revisarse si crece de forma significativa el número de colaboradores.

---

Documento elaborado por David Merino Recalde.  
Revisión pendiente de validación por el DPD de la Universitat Autònoma de Barcelona.
