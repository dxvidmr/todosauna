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
- `_sass/_laboratorio.scss`: estructura y estilos de la sesión activa; actúa temporalmente como agregador de los módulos extraídos.
- `_sass/_laboratorio-welcome.scss`: presentación del vestíbulo y estadísticas globales.

### Lectura

- `assets/js/lectura/sala-de-lectura.js`: orquestación actual de la sala; todavía contiene responsabilidades que deben separarse.
- `assets/js/lectura/notas-dom.js`: renderizado y marcado de notas en el texto.
- `assets/js/lectura/note-category-filter.js`: selección y aplicación de tipologías de notas.
- `assets/js/lectura/text-zoom.js`: control de tamaño del texto.
- `_sass/_lectura.scss` y `_sass/_lectura-components.scss`: estilos aún pendientes de dividir por responsabilidad.

## Orden de las siguientes extracciones

1. Controles y navegación entre pasajes del laboratorio.
2. Interfaz de notas del laboratorio, reutilizando los módulos compartidos existentes.
3. Estado y geometría del panel lateral de lectura.
4. Búsqueda y navegación interna de la sala de lectura.
5. Separación equivalente de SCSS por vestíbulo, sesión, paneles y puntos de ruptura.

## Reglas de migración

- Mantener las API que ya consumen las plantillas o las pruebas mientras se mueve su implementación.
- No convertir componentes opcionales en dependencias obligatorias.
- No cambiar simultáneamente estructura y diseño visual en una extracción técnica.
- Conservar UTF-8 y comprobar que no aparecen secuencias de mojibake.
- Validar escritorio, tableta y móvil cuando la extracción afecte geometría, gestos o puntos de ruptura.
