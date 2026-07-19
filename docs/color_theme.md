# Sistema de color

Todos a una conserva Bootstrap para la rejilla y los componentes estructurales, pero la paleta del proyecto se define exclusivamente en `_sass/_tokens.scss`.

## Fuente única

Los tokens Sass y las propiedades CSS públicas se generan en el mismo módulo. No se añaden colores mediante CSV, `theme.yml`, Bootswatch ni utilidades cromáticas de Bootstrap.

Los roles principales son:

- `accent`: acento granate de marca.
- `action`: acción principal en tinta oscura.
- `soft`: acción o superficie cálida secundaria.
- `muted`: control neutral de menor énfasis.
- `inverse`: contenido claro sobre una superficie oscura.
- `success`, `info`, `warning` y `danger`: estados del sistema.

## Clases públicas

Los botones combinan `.btn` con una variante propia, por ejemplo `.btn-action`, `.btn-accent`, `.btn-soft`, `.btn-muted` o `.btn-outline-accent`.

Las utilidades cromáticas disponibles expresan una función, por ejemplo `.text-subtle`, `.text-quiet`, `.text-inverse`, `.bg-surface-soft`, `.bg-inverse` y `.border-inverse-soft`.

Cuando un componente JavaScript necesita un color debe leer una propiedad semántica como `--color-accent` o `--color-status-success`; no debe duplicar valores hexadecimales.
