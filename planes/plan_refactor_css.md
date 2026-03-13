# Plan de refactor CSS/SCSS por fases (roadmap de trabajo)

## 1) Resumen ejecutivo

Este plan esta disenado para ejecutarse en varios dias, en fases pequenas y controladas, evitando un cambio masivo de una sola vez.

### Objetivo principal

Simplificar la arquitectura CSS/SCSS para:

- reducir solapes y reglas duplicadas;
- evitar la proliferacion de clases nuevas en cada iteracion;
- mantener el aspecto visual y la funcionalidad actual;
- facilitar que futuras tareas (humanas o de Codex) sigan reglas claras.

### Estado base (medido)

- Parciales SCSS en `_sass`: `13`
- CSS compilado actual (`_site/assets/css/cb.css`): `129.2 KB`
- Uso de `!important` en SCSS: `40`

### Decisiones ya cerradas

- Arquitectura destino de `5` nucleos SCSS.
- Se permiten cambios HTML de nivel alto (renombre y consolidacion de clases) para simplificar de verdad.
- Estrategia `Bootstrap-first`.
- Se mantiene un unico bundle: `cb.css`.
- Gobernanza ligera: documentacion + checklist manual (sin bloquear CI de forma estricta).

---

## 2) Contrato tecnico (como vamos a trabajar)

### 2.1 Interfaces publicas (HTML/JS/CSS)

- No se cambia la API de negocio JS.
- Durante la transicion, se mantienen hooks criticos usados por JS:
  - `.note-eval-dock`
  - `.note-nav-controls`
  - `.text-column`
  - `.numero-verso`
- Se permite renombrar clases visuales HTML para converger a clases canonicas.
- Contrato de modales:
  - modal custom de participacion: solo bajo `#modal-modo`;
  - modales Bootstrap: mantener contrato nativo por id (`#advancedSearchModal`, `#dataModal`, etc.);
  - prohibido anadir overrides globales de `.modal` fuera de scope explicito.

### 2.2 Arquitectura destino (5 nucleos SCSS)

1. `tokens`
2. `foundation`
3. `components`
4. `experiences`
5. `utilities`

Definicion:

- `tokens`: variables, maps, mixins, funciones (sin CSS emitido).
- `foundation`: base global, tipografia, reset suave, estilos transversales de bajo riesgo.
- `components`: bloques reutilizables (forms, cards, navbar, modal custom, etc.).
- `experiences`: estilos contextuales de lectura/laboratorio (siempre scopeados).
- `utilities`: clases utilitarias minimas (`u-*`) y estados (`is-*`, `has-*`).

### 2.3 Reglas anti-proliferacion (obligatorias)

1. No crear nuevos SCSS "por pagina".
2. Antes de crear clase nueva, seguir esta secuencia:
   - reutilizar Bootstrap;
   - reutilizar clase canonica existente;
   - crear modificador de componente;
   - solo como ultimo recurso: clase nueva + registrar en catalogo.
3. Todo selector nuevo debe tener "propietario de capa" (`foundation`, `components`, `experiences`, `utilities`).
4. Evitar selectores globales de alto riesgo (`.modal`, `.btn`, `.nav-link`) fuera de scope.
5. `!important` solo en casos justificados y documentados.

---

## 3) Plan por fases

## Fase 0 - Baseline y preparacion (Dia 1)

### Objetivo

Congelar metricas, reglas y lista de solapes criticos antes de mover codigo.

### Tareas

- Crear inventario de selectores y clases duplicadas entre parciales.
- Crear catalogo inicial de clases canonicas y aliases temporales.
- Crear checklist base para PRs de CSS.

### Entregables

- `docs/css-selector-catalog.md`
- `docs/css-pr-checklist.md`

### Criterio de cierre

- Baseline documentado y validado.
- Lista priorizada de solapes criticos cerrada (incluyendo al menos):
  - `.modo-form`
  - `.participa-form`
  - `.note-eval-dock`
  - `.note-nav-controls`
  - `.nota-posicion`
  - `.numero-verso`
  - `.text-column`
  - `.ta-card*`

---

## Fase 1 - Reorganizacion fisica (Dias 2-3)

### Objetivo

Migrar a la estructura de 5 nucleos sin rediseno y sin romper comportamiento.

### Tareas

- Reubicar bloques de:
  - `_main-custom.scss`
  - `_forms.scss`
  - `_lectura-components.scss`
  - `_lectura.scss`
  - `_laboratorio.scss`
- Ajustar orden en `assets/css/cb.scss` por capas.
- Mantener clases y output visual equivalentes.

### Criterio de cierre

- Build estable.
- Sin regresiones funcionales.
- Sin aumento de tamano de CSS compilado respecto baseline.

---

## Fase 2 - Modales y formularios (Dias 4-5)

### Objetivo

Eliminar colisiones mas peligrosas en modal/form y unificar contrato.

### Tareas

- Consolidar estilos del modal custom exclusivamente bajo `#modal-modo`.
- Eliminar reglas custom globales de `.modal` y derivados fuera de scope.
- Unificar estilos de formularios en un componente canonico (`participa-form` + variantes).
- Consolidar estados de formulario (`is-error`, `is-success`, `is-warning`) en un unico bloque.

### Criterio de cierre

- Flujo Participa completo estable.
- Modales Bootstrap intactos.
- Menor duplicidad en reglas de modal/form.

---

## Fase 3 - Contrato compartido Lectura/Laboratorio (Dias 6-8)

### Objetivo

Tener una base comun real para notas/evaluacion y dejar solo ajustes por contexto.

### Tareas

- Definir base unica para:
  - `.note-eval-dock`
  - `.note-nav-controls`
  - `.nota-posicion`
  - `.numero-verso`
  - `.text-column`
- Mantener ajustes especificos solo en contextos:
  - `.lectura-wrapper`
  - `.laboratorio-wrapper`
  - `.pasaje-container`
- Migrar reglas repetidas de lectura/laboratorio a componente compartido.

### Criterio de cierre

- Estados (`idle/loading/evaluated/error`) consistentes entre lectura y laboratorio.
- Sin colisiones cruzadas entre ambas experiencias.

---

## Fase 4 - Generalizacion y Bootstrap-first real (Dias 9-10)

### Objetivo

Reducir CSS custom innecesario y converger a patrones reutilizables.

### Tareas

- Sustituir patrones repetidos por utilidades Bootstrap cuando sea viable.
- Fusionar familias de clases equivalentes en componentes/modificadores canonicos.
- Reducir especificidad excesiva cuando el scope por capas ya resuelve precedencia.

### Criterio de cierre

- Menos clases ad-hoc.
- Menos reglas acopladas a paginas concretas.
- Sin perdida visual relevante.

---

## Fase 5 - Limpieza legacy y deuda tecnica (Dias 11-12)

### Objetivo

Retirar aliases y selectores muertos tras validar estabilidad.

### Tareas

- Eliminar selectores legacy no usados (verificados con `rg` en HTML/JS).
- Reagrupar media queries repetidas por componente/contexto.
- Reducir `!important` reemplazandolo con scope/orden de capa.

### Criterio de cierre

- `!important <= 30`.
- Sin selectores muertos detectables en paginas activas.

---

## Fase 6 - Estabilizacion continua (Dia 13+)

### Objetivo

Evitar recaida en complejidad tras nuevas funcionalidades.

### Tareas

- Mantener catalogo de selectores canonicos actualizado.
- Aplicar checklist CSS en cada cambio futuro.
- Revisar metricas trimestralmente (tamano, duplicacion, `!important`).

### Criterio de cierre

- Nuevos cambios entran por capas/componentes correctos, sin crear archivos por pagina.

---

## 4) Pruebas de validacion (en cada fase relevante)

### Flujos visuales

- Home
- Participa (formularios + modal de modo)
- Archivo de testimonios
- Lectura
- Laboratorio
- Browse/Search/Data/Compound object (modales Bootstrap)

### Interacciones clave

- Apertura/cierre modal de participacion.
- Apertura/cierre `#advancedSearchModal` y `#dataModal`.
- Estados de evaluacion en lectura/laboratorio/home-card.

### Regresion tecnica

- Verificar que hooks JS requeridos se mantienen (o alias hasta su retiro).
- Verificar responsive en breakpoints principales.

---

## 5) KPIs globales de aceptacion

- Parciales SCSS: `13 -> 5 nucleos`.
- CSS compilado: `129.2 KB -> <= 110 KB`.
- `!important`: `40 -> <= 30`.
- `#scroll-to-top`: `1` unica definicion.
- Reglas custom globales de `.modal`: `0` fuera de scopes explicitos.

---

## 6) Checklist de arranque para manana (Dia 1)

1. Crear/actualizar `docs/css-selector-catalog.md` con:
   - lista de clases canonicas;
   - aliases temporales;
   - capa propietaria por clase.
2. Crear/actualizar `docs/css-pr-checklist.md` con reglas anti-proliferacion.
3. Sacar snapshot de metricas actuales:
   - tamano de `cb.css`;
   - conteo de `!important`;
   - duplicados de selectores/clases.
4. Cerrar "Top 10 solapes" prioritarios (con owner y fase objetivo).
5. Preparar primer PR de Fase 1 solo de reorganizacion (sin cambios visuales intencionales).

---

## 7) Plantilla de trabajo por interaccion

Copiar y completar en cada sesion:

```md
### Sesion: YYYY-MM-DD

- Objetivo de la sesion:
- Fase:
- Archivos tocados:
- Clases canonicas afectadas:
- Aliases temporales anadidos/retirados:
- Riesgo principal:
- Pruebas ejecutadas:
- Resultado (OK/KO):
- Metricas antes/despues:
- Pendientes para la proxima sesion:
```

---

## 8) Supuestos y limites

- Se permiten ajustes visuales finos, pero no rediseno.
- La estabilidad funcional tiene prioridad sobre limpieza extrema en una sola iteracion.
- La compatibilidad temporal con aliases esta permitida durante migracion.
- No se divide el CSS por layouts en esta etapa; se deja preparado para una etapa futura si aporta valor.
