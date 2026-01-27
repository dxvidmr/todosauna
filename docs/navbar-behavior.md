# Sistema de Comportamiento del Navbar

## Descripción

Sistema centralizado para controlar el comportamiento del navbar en diferentes páginas del sitio mediante el atributo `data-navbar-behavior` en el elemento `<body>`.

## Archivo Principal

- **Ubicación**: `/assets/js/navbar-behavior.js`
- **Carga**: Se incluye automáticamente en los layouts `default.html`, `lectura.html` y `laboratorio.html`

## Tipos de Comportamiento

### 1. `hidden-on-load` (Home/Index)

- **Comportamiento**: Navbar oculto al cargar la página, aparece al hacer scroll hacia abajo
- **Uso**: Página de inicio
- **Trigger**: Scroll > 100px
- **Implementación**: Añade/quita la clase `.visible` al `.nav-wrapper`

```html
<body data-navbar-behavior="hidden-on-load">
```

**Estilos asociados** (en `_home.scss`):
```scss
.home-page .nav-wrapper {
  opacity: 0;
  transform: translateY(-20px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none;
}

.home-page .nav-wrapper.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

### 2. `auto-hide` (Lectura/Laboratorio)

- **Comportamiento**: 
  - Navbar visible al cargar
  - Se oculta al hacer scroll hacia abajo
  - Reaparece al hacer scroll hacia arriba
- **Uso**: Páginas de lectura y laboratorio
- **Trigger**: Scroll > 80px
- **Implementación**: Usa `transform: translateY(-100%)` para ocultar

```html
<body data-navbar-behavior="auto-hide">
```

**Características especiales**:
- Detecta scroll tanto en `window` como en `.text-column` (para layouts con columnas scrollables)
- Threshold de 10px para evitar cambios bruscos con pequeños movimientos

### 3. `fixed` o sin atributo (Resto de páginas)

- **Comportamiento**: Navbar siempre visible
- **Uso**: Todas las demás páginas (about, browse, data, etc.)
- **Implementación**: No aplica ninguna transformación

```html
<body>
<!-- o -->
<body data-navbar-behavior="fixed">
```

## Configuración por Layout

### default.html
```html
<body data-navbar-behavior="{% if page.url == '/' %}hidden-on-load{% endif %}">
```

### lectura.html
```html
<body data-navbar-behavior="auto-hide">
```

### laboratorio.html
```html
<body data-navbar-behavior="auto-hide">
```

### Otros layouts
No requieren el atributo, el navbar permanecerá siempre visible.

## API JavaScript

El script exporta un objeto global `window.NavbarBehavior` con métodos útiles:

```javascript
// Mostrar navbar manualmente
window.NavbarBehavior.showNavbar();

// Ocultar navbar manualmente
window.NavbarBehavior.hideNavbar();
```

### Ejemplo de uso

En el botón de scroll del hero (index.md):
```html
<div class="hero-scroll" 
     onclick="if(window.NavbarBehavior) window.NavbarBehavior.showNavbar(); 
              document.getElementById('explore-section').scrollIntoView({behavior: 'smooth'});">
```

## Variables de Configuración

Puedes ajustar estos valores en `navbar-behavior.js`:

```javascript
const scrollThreshold = 10;           // Mínimo movimiento para detectar scroll
const scrollTriggerDistance = 100;    // Distancia para activar comportamientos (hidden-on-load)
const autoHideTrigger = 80;           // Distancia para ocultar en auto-hide
```

## Estilos CSS Relacionados

### _navbar.scss
```scss
.nav-wrapper {
  position: fixed;
  top: 0;
  z-index: 1000;
  // ...
}
```

### _home.scss
```scss
.home-page .nav-wrapper { /* estilos para hidden-on-load */ }
```

### _lectura.scss
```scss
.lectura-wrapper .nav-wrapper {
  will-change: transform; // Optimización para animaciones
}
```

## Solución de Problemas

### El navbar no se oculta/muestra correctamente

1. Verifica que el atributo `data-navbar-behavior` esté en el `<body>`
2. Comprueba que el script `navbar-behavior.js` se carga correctamente
3. Revisa la consola del navegador para errores

### Conflictos con scroll en columnas

Si tienes un layout con scroll en columnas específicas (como `.text-column`), el script detecta automáticamente el scroll en ese elemento. Asegúrate de que la clase existe si usas `auto-hide`.

### Performance

El script usa `will-change: transform` en lectura para optimizar animaciones. Evita agregar múltiples listeners de scroll adicionales que puedan afectar el rendimiento.

## Mantenimiento

Para agregar un nuevo tipo de comportamiento:

1. Añade una nueva función `initNuevoComportamiento()` en `navbar-behavior.js`
2. Agrégala al `switch` statement
3. Documenta el nuevo comportamiento aquí
4. Actualiza los layouts según necesites
