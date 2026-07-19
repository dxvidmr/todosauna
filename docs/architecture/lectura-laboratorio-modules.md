# Módulos de lectura y laboratorio

## Objetivo

Reducir progresivamente los archivos monolíticos de lectura y laboratorio sin alterar su comportamiento ni duplicar lógica entre vistas. Cada extracción debe tener una interfaz explícita, conservar el orden efectivo de los estilos y poder validarse de forma aislada.

## Puntos de entrada

- `assets/js/entry/lectura-page.js` prepara la sala de lectura y carga sus datos.
- `assets/js/entry/laboratorio-page.js` prepara el laboratorio y sus dependencias compartidas.
- Los puntos de entrada son los únicos responsables de arrancar una página completa. Los módulos internos no deben crear una segunda inicialización global.

## Límites actuales

### Laboratorio

- `assets/js/lectura/laboratorio.js`: orquestación del editor, estado de la actividad y coordinación de la interfaz.
- `assets/js/lectura/laboratorio-session.js`: rutas del vestíbulo y de la sesión, modo solicitado y persistencia local con caducidad.
- `assets/js/lectura/laboratorio-passage-controls.js`: presentación del modo, progreso y estado de los controles anterior/siguiente en ambos shells.
- `assets/js/lectura/laboratorio-note-controls.js`: contadores, progreso, apertura y navegación de la interfaz de notas.
- `_sass/_laboratorio.scss`: agregador estable; conserva el orden `welcome`, `core`, `notes` y `responsive`.
- `_sass/_laboratorio-welcome.scss`: presentación del vestíbulo y estadísticas globales.

### Lectura

- `assets/js/lectura/sala-de-lectura.js`: orquestación de carga del TEI, notas y controladores de la sala.
- `assets/js/lectura/lectura-panel-layout.js`: geometría, redimensionamiento y compensación del panel en escritorio, tableta y móvil.
- `assets/js/lectura/lectura-search.js`: índice local, resultados y navegación a versos o notas.
- `assets/js/lectura/notas-dom.js`: renderizado y marcado de notas en el texto.
- `assets/js/lectura/note-category-filter.js`: selección y aplicación de tipologías de notas.
- `assets/js/lectura/text-zoom.js`: control de tamaño del texto.
- `_sass/_lectura.scss`: agregador de base, panel y contenido TEI.
- `_sass/_lectura-components.scss`: agregador de componentes base, sugerencias, participación, notas y responsive.

## Estado de la fase 3

La fase de modularización queda cerrada con puntos de entrada pequeños, controladores JS con interfaces explícitas y agregadores Sass que preservan el orden de la cascada. Las divisiones futuras dentro de la orquestación o de los módulos de contenido serán mantenimiento incremental, no una dependencia de las fases posteriores de la hoja de ruta.

## Reglas de migración

- Mantener las API que ya consumen las plantillas o las pruebas mientras se mueve su implementación.
- No convertir componentes opcionales en dependencias obligatorias.
- No cambiar simultáneamente estructura y diseño visual en una extracción técnica.
- Conservar UTF-8 y comprobar que no aparecen secuencias de mojibake.
- Validar escritorio, tableta y móvil cuando la extracción afecte geometría, gestos o puntos de ruptura.
