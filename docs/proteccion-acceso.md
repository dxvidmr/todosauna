# Protección de acceso (autenticación básica)

Todo el sitio desplegado en Vercel queda detrás de autenticación básica HTTP: el navegador pide usuario y contraseña antes de servir cualquier recurso (páginas, imágenes, CSV, JSON, XML). No hace falta cuenta de Vercel para entrar.

## Cómo funciona

- `middleware.ts`, en la raíz del repositorio, es un [Routing Middleware](https://vercel.com/docs/routing-middleware) de Vercel (disponible en todos los planes). Vercel lo detecta por el nombre del archivo; no hace falta la propiedad `proxy` de `vercel.json`.
- No declara `matcher`, así que se ejecuta en todas las rutas, incluidos los archivos estáticos.
- Usa `next()` de `@vercel/functions` para dejar pasar la petición. Por eso `vercel.json` instala las dependencias de npm de producción (`bundle install && npm ci --omit=dev`); Playwright, que es de desarrollo, no se instala en Vercel.
- Lee las credenciales de `SITE_USER` y `SITE_PASSWORD`. Si falta alguna, responde siempre 401: el sitio queda cerrado, no abierto.
- Compara usuario y contraseña mediante sus resúmenes SHA-256, recorriendo todos los bytes y evaluando las dos comparaciones siempre.
- Si las credenciales no son válidas responde `401` con `WWW-Authenticate: Basic realm="Todos a una"`.
- Todas las respuestas, también las 401, llevan `X-Robots-Tag: noindex`. Es independiente de la opción `noindex` de `_config.yml` (ver [noindex.md](noindex.md)), que solo añade la etiqueta `<meta name="robots">` al HTML.
- `middleware.ts` está en `exclude` de `_config.yml` para que Jekyll no lo copie a `_site`.

En local (`bundle exec jekyll serve`, pruebas de Playwright) el middleware no se ejecuta: solo actúa en Vercel.

## Activarlo en Vercel

1. En el proyecto de Vercel: **Settings → Environment Variables**.
2. Crear `SITE_USER` con el usuario, marcando los entornos **Production** y **Preview**.
3. Crear `SITE_PASSWORD` con la contraseña, en los mismos entornos. Marcarla como *Sensitive*.
4. Volver a desplegar (las variables nuevas solo se aplican a despliegues posteriores).

Para cambiar la contraseña: editar `SITE_PASSWORD` y volver a desplegar. Los navegadores que tengan guardada la anterior volverán a pedirla.

## Comprobarlo

Sustituir `https://SITIO` por el dominio de producción o de una preview.

Sin credenciales debe dar 401 con el realm y `noindex`:

```bash
curl -sI https://SITIO/
```

Lo mismo en recursos estáticos:

```bash
curl -sI https://SITIO/assets/data/metadata.json
```

Con credenciales correctas debe dar 200 y `x-robots-tag: noindex`:

```bash
curl -sI -u "USUARIO:CONTRASEÑA" https://SITIO/
```

Con una contraseña incorrecta, de nuevo 401:

```bash
curl -sI -u "USUARIO:otra" https://SITIO/
```

En el navegador, abrir el sitio en una ventana privada: debe aparecer el cuadro de usuario y contraseña, y tras entrar deben cargar la colección, el mapa, la línea de tiempo y la sala de lectura sin errores en consola.

En **Observability** (o en los registros de funciones del despliegue) debe aparecer el middleware con invocaciones.

## Si deja de funcionar

- Si todo el sitio da 401 incluso con las credenciales correctas, comprobar que las dos variables existen en el entorno de ese despliegue (Production o Preview) y que se ha vuelto a desplegar.
- Si el sitio se abre sin pedir contraseña, el middleware no se ha desplegado: revisar en el registro de build que se compila `middleware.ts` y que `npm ci` se ha ejecutado. Como alternativa se puede declarar explícitamente en `vercel.json` con `"proxy": { "entrypoint": "middleware.ts" }`.
