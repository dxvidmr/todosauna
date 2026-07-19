# Compilación y validación

## Entorno fijado

El proyecto usa Ruby 3.4, Jekyll 4.4.1 y Node.js 20 o posterior. Las versiones exactas de las gemas se conservan en `Gemfile.lock`, que debe permanecer versionado y contener las plataformas `ruby`, de desarrollo y `x86_64-linux` para CI y despliegue.

Primera instalación:

```bash
bundle install
npm ci
```

Si se modifica `Gemfile`, hay que actualizar el lock de forma explícita:

```bash
bundle lock --add-platform ruby x86_64-linux
bundle install
```

## Desarrollo local

```bash
bundle exec jekyll serve
```

El sitio queda disponible por defecto en `http://127.0.0.1:4000`. El contenido generado se escribe en `_site/` y no se versiona.

## Comprobaciones estructurales

```bash
npm run check
```

Este comando agrupa tres controles rápidos:

- referencias JavaScript heredadas y carga mediante ES Modules;
- restos de la nomenclatura cromática sustituida;
- UTF-8, posibles secuencias de mojibake, finales de línea mezclados y sintaxis de los CSV y XML.

Se pueden ejecutar por separado con `npm run check:no-legacy-runtime`, `npm run check:color-system` y `npm run validate:data`.

Si la validación detecta finales de línea mezclados, `npm run format:text` los normaliza a LF sin cambiar la codificación.

## Compilación

Compilación de desarrollo con traza:

```bash
npm run build
```

Compilación de producción, válida también en Windows:

```bash
npm run build:production
```

Vercel ejecuta directamente `bundle exec jekyll build` con `JEKYLL_ENV=production`. CI y despliegue deben resolver las gemas desde el `Gemfile.lock` versionado, no generar combinaciones nuevas de dependencias.

## Codificación y finales de línea

Los archivos de código, configuración, documentación, CSV y XML son UTF-8. `.gitattributes` guarda sus finales de línea como LF aunque el proyecto se edite desde Windows. No hay que convertir archivos en bloque desde PowerShell sin especificar UTF-8, porque se puede alterar el texto español o introducir finales de línea mezclados.
