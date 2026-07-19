# Datos excluidos del build

Esta carpeta conserva archivos de trabajo que no tienen consumidores en el sitio. Está excluida en `_config.yml`, por lo que Jekyll no los carga como `site.data` ni los copia a `_site`.

- `prueba-CB-Fuenteovejuna-metadata.csv`: copia de trabajo de los metadatos de CollectionBuilder.
- `Supabase Snippet Public Testimonials with Privacy-Aware Fields.csv`: resultado de prueba de una consulta de testimonios.

Si alguno vuelve a utilizarse en runtime, debe trasladarse de forma explícita a `_data/` y documentar su consumidor.
