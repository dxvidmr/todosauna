---
layout: page
title: Inicio
permalink: /
---

<section class="hero">
        <div class="hero-content">
            <h1 class="hero-title">
                Todos a una
            </h1>
            <p class="hero-subtitle">
                Todo sobre <i>Fuenteovejuna</i>, de Lope de Vega
            </p>
            <p class="hero-description">
                Un portal integral que combina edición crítica, participación ciudadana, 
                archivo documental y recursos educativos sobre la obra cumbre de Lope.
            </p>
        </div>
    <!-- Scroll indicator -->
    <div class="hero-scroll" onclick="document.querySelector('.nav-wrapper').classList.add('visible'); document.getElementById('site-grid').scrollIntoView({behavior: 'smooth'});">
        <span>Explorar el sitio</span>
        <i class="fa-solid fa-chevron-down"></i>
    </div>
</section>

<!-- Sección de grilla de apartados -->
<section id="site-grid" class="site-grid">
    <div class="grid-container">
        <a href="lectura/" class="grid-item large">
            <i class="fa-solid fa-book-open"></i>
            <h3>Sala de lectura</h3>
            <p>Edición digital interactiva de Fuenteovejuna</p>
        </a>
        <a href="laboratorio/" class="grid-item">
            <i class="fa-solid fa-flask"></i>
            <h3>Laboratorio de notas</h3>
            <p>Espacio para anotaciones y colaboraciones</p>
        </a>
        <a href="archivo/" class="grid-item">
            <i class="fa-solid fa-archive"></i>
            <h3>Archivo</h3>
            <p>Documentos históricos y materiales relacionados</p>
        </a>
        <a href="map/" class="grid-item">
            <i class="fa-solid fa-map"></i>
            <h3>Mapa</h3>
            <p>Explora ubicaciones relacionadas con la obra</p>
        </a>
        <a href="timeline/" class="grid-item">
            <i class="fa-solid fa-timeline"></i>
            <h3>Línea de tiempo</h3>
            <p>Cronología de eventos y contexto histórico</p>
        </a>
        <a href="acerca-de/" class="grid-item">
            <i class="fa-solid fa-info-circle"></i>
            <h3>Acerca de</h3>
            <p>Información sobre el proyecto</p>
        </a>
    </div>
</section>

<script>
// Mostrar navbar al hacer scroll en la home
if (document.body.classList.contains('home-page')) {
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        const navWrapper = document.querySelector('.nav-wrapper');
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Mostrar navbar si se hace scroll hacia abajo más de 100px
        if (scrollTop > 100) {
            navWrapper.classList.add('visible');
        } else {
            navWrapper.classList.remove('visible');
        }
        
        lastScrollTop = scrollTop;
    });
}
</script>