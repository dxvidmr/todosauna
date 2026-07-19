# Opciones avanzadas del tema

## Tipografía

`_data/theme.yml` conserva únicamente las opciones tipográficas y funcionales del tema:

- `base-font-size` ajusta el tamaño base del documento.
- `base-font-family` define la familia tipográfica de `body`.
- `font-cdn` añade al `<head>` la hoja de estilos que carga la fuente.

Los colores no se configuran en `theme.yml`. La navegación y el resto de componentes consumen los roles definidos en `_sass/_tokens.scss`, tal como se explica en `docs/color_theme.md`.

Bootstrap continúa cargándose localmente para rejilla, formularios y comportamiento de componentes. Bootswatch no está soportado porque introduciría una segunda fuente cromática.

## Iconos

Consulta `docs/icons.md` para las opciones de iconos.
