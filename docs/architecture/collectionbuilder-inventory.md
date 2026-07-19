# Inventario de CollectionBuilder y política de recuperación

Fecha del inventario: 2026-07-19

Línea base local verificada: `c3a6220`

Plantilla inicial del repositorio: `d2d678c30708788be100787fd9e9964cd8e83e98`

Repositorio de origen: <https://github.com/CollectionBuilder/collectionbuilder-csv>

## Propósito

Este documento delimita qué partes de *Todos a una* proceden de CollectionBuilder, cuáles se han adaptado y cuáles siguen siendo una biblioteca potencialmente útil aunque no tengan consumidores actuales. Que una pieza no se use hoy no basta para borrarla.

Antes de retirar cualquier archivo habrá que registrar aquí:

1. su función y sus consumidores actuales;
2. por qué deja de ser necesario;
3. el commit local anterior a la retirada;
4. la ruta equivalente en CollectionBuilder, cuando exista;
5. las adaptaciones locales que habría que reaplicar al recuperarlo.

## Estados utilizados

| Estado | Significado | Acción por defecto |
|---|---|---|
| `crítico` | Participa en la compilación o en rutas activas. | Conservar; solo sustituir mediante migración probada. |
| `adaptado` | Procede de CB, pero contiene decisiones propias del proyecto. | Tratar como código propio; no sobrescribir desde upstream. |
| `reutilizable` | No tiene consumidor actual o solo lo usa la demo, pero ofrece una función razonable para el futuro. | Conservar; se puede aislar o documentar mejor. |
| `demo` | Contenido de ejemplo de la plantilla, sin relación editorial con *Todos a una*. | Candidato a archivar; no borrar sin registrar recuperación. |
| `referencia` | Manuales, licencias o ejemplos útiles para entender el origen. | Conservar fuera del flujo principal; se puede agrupar. |
| `propio` | Creado para *Todos a una*. | Fuera del alcance de la limpieza de CB. |

## 1. Núcleo crítico de generación

| Rutas | Estado | Uso comprobado |
|---|---|---|
| `_plugins/cb_page_gen.rb` | `crítico` | Genera las fichas de la colección desde `_data/CB-Fuenteovejuna-metadata.csv`. |
| `_plugins/cb_helpers.rb` | `crítico` y `adaptado` | Genera datos auxiliares de imagen destacada e iconos usados por layouts y metadatos. |
| `_plugins/array_count_uniq.rb` | `crítico` | Proporciona el filtro empleado por nubes y visualizaciones derivadas de metadatos. |
| `_config.yml` | `crítico` y `adaptado` | Conserva la convención `metadata` que activa el generador de páginas. |
| `_data/CB-Fuenteovejuna-metadata.csv` | `crítico` y `adaptado` | Fuente editorial principal: 155 imágenes, 1 PDF y 1 objeto compuesto en el inventario actual. |
| `_data/config-browse.csv`, `config-map.csv`, `config-metadata.csv`, `config-nav.csv`, `config-search.csv`, `config-table.csv` | `crítico` y `adaptado` | Configuran navegación, archivo, mapa, búsqueda, tablas y fichas. |
| `_data/theme.yml` | `crítico` y `adaptado` | Aún configura comportamiento, tipografía y opciones funcionales de CB. |

Estos archivos no son candidatos a cuarentena inmediata. Primero habría que sustituir sus interfaces por otras propias.

## 2. Fichas y tipos documentales

### Consumidos actualmente

| Rutas | Estado | Uso comprobado |
|---|---|---|
| `_layouts/item/image.html` | `crítico` y `adaptado` | Plantilla de 155 registros actuales. |
| `_layouts/item/pdf.html` | `crítico` y `adaptado` | Plantilla de 1 registro actual. |
| `_layouts/item/compound_object.html` | `crítico` y `adaptado` | Plantilla de 1 objeto compuesto actual. |
| `_layouts/item/item-page-base.html`, `item-page-full-width.html` | `crítico` y `adaptado` | Estructura común de las fichas anteriores. |
| `_includes/item/**` y `_includes/item/child/**` | `crítico` y `adaptado` | Metadatos, descargas, galerías, derechos, navegación y renderizado de hijos. |

### Sin registros actuales, pero reutilizables

| Rutas | Estado | Función futura |
|---|---|---|
| `_layouts/item/audio.html` | `reutilizable` | Fichas con reproductor de audio. |
| `_layouts/item/video.html` | `reutilizable` | Vídeo local, YouTube o Vimeo según metadatos. |
| `_layouts/item/panorama.html` | `reutilizable` | Imágenes panorámicas. |
| `_layouts/item/record.html` | `reutilizable` | Registros sin objeto visual específico. |
| `_layouts/item/multiple.html` | `reutilizable` | Objetos con varias vistas o imágenes. |
| `_layouts/item/item.html` | `reutilizable` | Fallback genérico del generador. |
| Includes de audio, vídeo, panorama y objetos múltiples bajo `_includes/item/` | `reutilizable` | Dependencias de las plantillas anteriores. |

Estas piezas se conservan aunque el CSV principal no las invoque hoy.

## 3. Componentes editoriales reutilizables

Los 20 archivos de `_includes/feature/` son una biblioteca de composición para páginas Markdown. Actualmente su consumidor visible es principalmente la demostración de CB, pero pueden ser útiles para futuras páginas temáticas.

| Componentes | Estado | Decisión |
|---|---|---|
| `accordion`, `alert`, `blockquote`, `button`, `card`, `collapse`, `icon`, `modal`, `nav-menu` | `reutilizable` | Conservar como componentes editoriales generales. |
| `audio`, `audio-modal`, `video`, `video-modal`, `image`, `pdf`, `gallery` | `reutilizable` | Conservar: permiten incorporar nuevos tipos documentales sin reprogramarlos. |
| `cloud`, `mini-map`, `timelinejs`, `jumbotron` | `reutilizable` | Conservar por ahora; revisar junto con visualizaciones y mapas. |

Antes de aislar esta carpeta habrá que comprobar si conviene renombrarla como biblioteca editorial propia y adaptar sus parámetros a la nomenclatura semántica actual.

## 4. Rutas y visualizaciones activas de CB

| Rutas | Estado | Consumidores actuales |
|---|---|---|
| `_layouts/browse.html` | `crítico` y `adaptado` | `pages/documentos.md`. |
| `_layouts/cloud.html` | `crítico` y `adaptado` | `pages/subjects.md` y `pages/locations.md`. |
| `_layouts/map.html` | `crítico` y `adaptado` | `pages/map.md`. |
| `_layouts/timeline.html` | `crítico` y `adaptado` | `pages/timeline.md`. |
| `_layouts/data.html` | `crítico` y `adaptado` | `pages/data.md`. |
| `_layouts/search.html` | `crítico` y `adaptado` | `pages/search.md`. |
| `_includes/js/browse-js.html`, `browse-simple-js.html`, `cloud-js.html`, `map-js.html`, `table-js.html`, `timeline-js.html`, `lunr-js.html`, `masonry-lib.html` | `crítico` y `adaptado` | Se cargan mediante `custom-foot` o desde los layouts anteriores. |
| `assets/js/lunr-store.js`, `metadata.min.json` | `crítico` y `adaptado` | Datos generados para búsqueda y consumo del frontend. |

Aunque algunas rutas no estén en la navegación principal, existen y compilan. Su retirada requeriría una decisión funcional, no solo técnica.

## 5. Estructura compartida adaptada

| Rutas | Estado | Observación |
|---|---|---|
| `_layouts/default.html`, `page.html`, `about.html` | `crítico` y `adaptado` | Son la base del sitio actual y contienen navegación, modales y participación propios. |
| `_layouts/page-full-width.html`, `page-narrow.html`, `about-narrow.html` | `reutilizable` | Variantes generales que pueden volver a usarse. |
| `_includes/head/**`, `_includes/navbar.html`, `_includes/footer.html`, `_includes/foot.html` | `crítico` y `adaptado` | Mezclan infraestructura CB con diseño y runtime propios. |
| `_sass/_base.scss` y `_sass/_pages.scss` | `crítico` y `adaptado` | Capa de compatibilidad que sigue entrando en `assets/css/cb.scss`. |
| `assets/lib/**` | `crítico` y `referencia` | Dependencias vendorizadas de Bootstrap, Lunr, Leaflet, DataTables, Spotlight, etc. Se revisarán por biblioteca, no en bloque. |

## 6. Alternativas de plantilla no activas

| Rutas | Estado | Situación |
|---|---|---|
| `_layouts/home-infographic.html` | `reutilizable` | Portada alternativa de CB; ninguna página usa hoy este layout. |
| `_includes/index/**` | `reutilizable` | Seis bloques necesarios para `home-infographic`. |
| `_includes/js/home-carousel-js.html` | `reutilizable` | Soporte del carrusel de esa portada alternativa. |
| `_includes/collection-banner.html` | `reutilizable` | Se conserva, pero su llamada comentada se retiró de `default` para que Liquid no la procese. |
| `_includes/scroll-to-top.html` | `reutilizable` | Se conserva como función recuperable; su llamada comentada ya no se procesa en cada página. |

No se borrarán en la primera limpieza. Como máximo se podrán agrupar en una zona de compatibilidad después de verificar que Jekyll mantiene sus rutas de include.

## 7. Demostración de CollectionBuilder retirada

| Rutas retiradas | Estado anterior | Recuperación |
|---|---|---|
| `pages/about-cb.md` | `demo` | `git restore --source=c3a6220 -- pages/about-cb.md` |
| `_includes/cb/about_the_about.md`, `feature_options.md`, `credits.html` | `demo` y `referencia` | Restaurables individualmente desde `c3a6220` o CollectionBuilder oficial. |
| `_data/demo-metadata.csv`, `demo-compoundobjects-metadata.csv`, `demo-compoundobjects-allmedia.csv` | `demo` | Restaurables desde `c3a6220`; solo deben volver a `_data` si tienen un consumidor real. |
| 26 archivos `objects/demo_*`, `210*`, `hells_half_theta*`, `hughes_article*` y derivados | `demo` | Restaurables desde `c3a6220` junto con sus CSV. |

La retirada elimina una página generada, tres CSV que Jekyll analizaba y aproximadamente 13,16 MB de objetos copiados a `_site`. No se eliminó ningún archivo de `_includes/feature/` ni ninguna plantilla documental reutilizable.

### Datos de trabajo conservados fuera del build

| Rutas | Estado | Situación |
|---|---|---|
| `data-archive/prueba-CB-Fuenteovejuna-metadata.csv` | `referencia` | Copia de trabajo sin consumidores; conserva historial, pero `data-archive/` está excluido de Jekyll. |
| `data-archive/Supabase Snippet Public Testimonials with Privacy-Aware Fields.csv` | `referencia` | Resultado de prueba sin consumidores, también excluido del build. |

## 8. Documentación y herramientas heredadas

| Rutas | Estado | Decisión provisional |
|---|---|---|
| `README-CB.md` y `LICENSE` | `referencia` | Conservar por procedencia y licencias. |
| Los 25 manuales CB en `docs/` —entre ellos `advanced_theme.md`, `cloud.md`, `compound_objects.md`, `icons.md`, `item_pages.md`, `metadata.md`, `plugins.md` y `rake_tasks.md`— | `referencia` | Se pueden agrupar bajo `docs/collectionbuilder/`, sin borrar. |
| `Rakefile`, `rakelib/deploy.rake` | `crítico` | `npm run build:production` depende de `rake deploy`. |
| Las otras cinco tareas de `rakelib/` | `reutilizable` | Operaciones de descarga, renombrado y derivados; conservar mientras haya objetos locales. |
| `_includes/cb/jekyll-toc.html` | `crítico` y `referencia` | Se usa en `_layouts/about.html`; contiene licencia propia de `jekyll-toc`. Puede aislarse como tercero, pero no borrarse. |

## 9. Código propio fuera del alcance

No se clasificará como legado por convivir con nombres de CB:

- `_layouts/lectura.html`, `_layouts/laboratorio.html`;
- `_includes/lectura/**`, `_includes/laboratorio/**`, `_includes/participacion/**`, `_includes/ui/**`, `_includes/cards/**`;
- `assets/js/lectura/**`, `assets/js/participacion/**`, `assets/js/shared/**`;
- los Sass de lectura, laboratorio, navegación, modales, paneles y tokens semánticos;
- los datos editoriales, TEI, Supabase y tarjetas YAML propios.

Las referencias `cb:` dentro del TEI o `data-cb-objectid` en JavaScript describen identificadores de la colección y no son por sí mismas legado eliminable.

## Recuperación

### Recuperación exacta de la línea base local

Es la opción preferida porque conserva todas las adaptaciones existentes el día del inventario:

```bash
git restore --source=c3a6220 -- ruta/del/archivo
```

Para consultar antes de restaurar:

```bash
git show c3a6220:ruta/del/archivo
```

### Recuperación desde la plantilla inicial del proyecto

```bash
git restore --source=d2d678c30708788be100787fd9e9964cd8e83e98 -- ruta/del/archivo
```

### Recuperación desde CollectionBuilder oficial

```bash
git remote add collectionbuilder-upstream https://github.com/CollectionBuilder/collectionbuilder-csv.git
git fetch collectionbuilder-upstream
git show collectionbuilder-upstream/main:ruta/del/archivo
```

No se debe restaurar directamente sobre el árbol de trabajo desde upstream: primero hay que comparar el archivo oficial con `c3a6220`, porque los componentes locales pueden contener traducciones, clases semánticas, cambios de Bootstrap o integración con el runtime propio.

## Estado del primer corte

1. La demostración y sus objetos se han retirado con recuperación documentada.
2. Los datos de trabajo sin consumidores se conservan bajo `data-archive/`, fuera del build.
3. Se mantienen todos los componentes funcionales, incluidos audio, vídeo, PDF, galería y tipos de ficha no usados hoy.
4. No se han movido plugins, layouts activos, documentación heredada ni `assets/lib`.
5. `npm run check:collectionbuilder`, incluido en `npm run check`, detecta si reaparecen rutas demo o cambia una superficie inventariada.
