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
<section id="site-grid" class="py-5">
    <div class="container">
        <div class="row g-4">
            <div class="col-lg-4 col-md-6 col-12">
                <a href="lectura/" class="card h-100 text-decoration-none text-center">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center">
                        <i class="fa-solid fa-book-open fa-3x text-primary mb-3"></i>
                        <h5 class="card-title">Sala de lectura</h5>
                        <p class="card-text text-muted">Edición digital interactiva de Fuenteovejuna</p>
                    </div>
                </a>
            </div>
            <div class="col-lg-4 col-md-6 col-12">
                <a href="laboratorio/" class="card h-100 text-decoration-none text-center">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center">
                        <i class="fa-solid fa-flask fa-3x text-primary mb-3"></i>
                        <h5 class="card-title">Laboratorio de notas</h5>
                        <p class="card-text text-muted">Espacio para anotaciones y colaboraciones</p>
                    </div>
                </a>
            </div>
            <div class="col-lg-4 col-md-6 col-12">
                <a href="archivo/" class="card h-100 text-decoration-none text-center">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center">
                        <i class="fa-solid fa-archive fa-3x text-primary mb-3"></i>
                        <h5 class="card-title">Archivo</h5>
                        <p class="card-text text-muted">Documentos históricos y materiales relacionados</p>
                    </div>
                </a>
            </div>
            <div class="col-lg-4 col-md-6 col-12">
                <a href="map/" class="card h-100 text-decoration-none text-center">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center">
                        <i class="fa-solid fa-map fa-3x text-primary mb-3"></i>
                        <h5 class="card-title">Mapa</h5>
                        <p class="card-text text-muted">Explora ubicaciones relacionadas con la obra</p>
                    </div>
                </a>
            </div>
            <div class="col-lg-4 col-md-6 col-12">
                <a href="timeline/" class="card h-100 text-decoration-none text-center">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center">
                        <i class="fa-solid fa-timeline fa-3x text-primary mb-3"></i>
                        <h5 class="card-title">Línea de tiempo</h5>
                        <p class="card-text text-muted">Cronología de eventos y contexto histórico</p>
                    </div>
                </a>
            </div>
            <div class="col-lg-4 col-md-6 col-12">
                <a href="acerca-de/" class="card h-100 text-decoration-none text-center">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center">
                        <i class="fa-solid fa-info-circle fa-3x text-primary mb-3"></i>
                        <h5 class="card-title">Acerca de</h5>
                        <p class="card-text text-muted">Información sobre el proyecto</p>
                    </div>
                </a>
            </div>
        </div>
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