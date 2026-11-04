# Archivos TEI de la edición

Esta carpeta contiene los tres archivos TEI de la edición digital de *Fuenteovejuna*. Los tres comparten un solo número de edición, que figura en el `teiHeader` de cada uno y en una etiqueta de Git.

## Los archivos

`fuenteovejuna.xml` es el texto base, basado en el texto de la edición de PROLOPE de 2009, con sus versos, parlamentos, acotaciones, estrofas y la declaración de personajes. `notas.xml` guarda las notas, que se enlazan con el texto base a través de identificadores. `relaciones.xml` declara qué objeto de la colección digital representa qué pasaje, y se genera automáticamente a partir de la capa de la colección para que se mantenga siempre actualizado.

## Identificadores y prefijos

Los versos se identifican como `l-N` (con `-a` y `-b` si el verso se parte), los parlamentos como `sp-N` (correlativos en el orden del documento), los segmentos como `seg-V-k` (el k-ésimo segmento del verso V) y las acotaciones como `stg-V` (la acotación que sigue al verso V, con `-k` si hay varias, para seguir la identificación usada generalmente en las ediciones). Las notas son `n-V-k` (V es el último verso o pasaje al que se refieren, como la llamada de una nota al pie, que va al final del pasaje). Los segmentos de acotación que llevan nota se llaman `seg-stg-…`, y esas notas, `n-stg-…`. Los objetos de la colección son `fo-xxxxxx` (con `-NN` si es una imagen que es parte de un objeto compuesto), y son los únicos `id` opacos.

En los enlaces, `texto:` apunta a un elemento del texto base, `cb:` a un objeto de la colección digital y `p2009:` a la nota con ese número en la edición de PROLOPE. Cada prefijo se declara con `prefixDef` en la cabecera del archivo donde se usa.

## Versiones, `change` y procedencia

Se numera una versión cuando se cierra un conjunto de cambios que conviene poder citar. Sube el mayor si una referencia a la versión anterior (un número de verso, un identificador) deja de apuntar a lo mismo, y sube el menor si cambia el contenido (lecturas, notas, hablantes, relaciones) y las referencias siguen valiendo. Los cambios se acumulan hasta la versión siguiente. Cada versión lleva un `change` «Versión X.Y: explicación breve de qué cambia.» y una etiqueta de Git `vX.Y`.

El `revisionDesc` de cada archivo recoge lo que se hizo, con la fecha real, firmado por `#DMR` o quien sea autor del cambio y con lo más reciente arriba. Un `change` con fecha cuenta una intervención de ese día. Un identificador de `change` usado no se reutiliza. El historial del texto base anterior al 26 de enero de 2026 es aproximado, pues se reconstruyó de las copias de trabajo y de Git.

En `notas.xml`, el valor completo de `@change` de cada nota es su versión para la participación, en combinación con el propio `id`, pues la web guarda las evaluaciones con el identificador de la nota y ese valor. Es decir, una nota tiene su identidad, pero como cambia en el tiempo, necesitamos el `@change` para saber qué versión de la nota referimos. Por eso solo se añade un valor a `@change` cuando cambia el texto de la nota, su ancla o su clasificación; si no, no se toca. El primer valor de `@change` indica el origen de la nota: si viene de PROLOPE 2009 tal cual o si se dividió, se ancló en otro punto o se le quitó la remisión a la *Guía didáctica*. Esos cambios no tienen un día exacto porque no lo anoté, por lo que se nombran como antes del 27 de abril de 2026. `@source="p2009:NNN"` indica de qué nota de PROLOPE 2009 procede una nota.

## Hablantes

Todo `<sp>` lleva `@who` con la persona o el grupo declarado en `listPerson`. La etiqueta impresa (`<speaker>`) se respeta tal como la trae PROLOPE, salvo la errata «ALCADE» y la numeración de los regidores. Si la identificación es una hipótesis (por ejemplo, quién es «el Regidor» en una escena), el `<sp>` lleva `@cert="medium"` o `"low"`; sin `@cert`, la certeza es alta. La web marca con un subrayado punteado las etiquetas que no coinciden con el nombre de la persona y muestra su nombre. Para que no se marquen las que no son ambiguas (COMENDADOR, REY…), la persona lleva un `<persName type="etiqueta">` con el nombre con que se rotula, pues a veces la etiqueta difiere de su declaración en el propio *dramatis personae*.

## Comprobar los archivos

El script `scripts/collection/validar_tei.py` (repositorio `fuenteovejuna-data`) valida los tres archivos contra `tei_all` con jing y comprueba lo que el esquema no ve: enlaces de notas y relaciones, identificadores repetidos, `@change`, `@source`, `@who`, personas sin uso, la misma edición en los tres y `@cert` en las relaciones. Se ejecuta antes de cerrar cada versión.

## Licencia

Pendiente: la licencia de todos los archivos queda pendiente.
