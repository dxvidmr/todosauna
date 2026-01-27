---
layout: page-full-width
title: Inicio
permalink: /
---

<section class="hero">
    <div class="hero-content">
        <h1 class="hero-title">
            TODOS A UNA
        </h1>
        <div class="hero-image">
            <img src="{{ '/assets/img/hero/hero.jpg' | relative_url }}" alt="Fuenteovejuna">
        </div>
    </div>
    <!-- Scroll indicator -->
    <div class="hero-scroll" onclick="document.querySelector('.nav-wrapper').classList.add('visible'); document.getElementById('explore-section').scrollIntoView({behavior: 'smooth'});">
        <span>Explorar el sitio</span>
        <i class="fa-solid fa-chevron-down"></i>
    </div>
</section>

<!-- Sección de exploración con carrusel -->
<section id="explore-section" class="explore-section">
    <div class="container">
        <div class="explore-content text-center">
            <!--<p class="explore-badge">TODOS A UNA</p>-->
            <h2 class="explore-title">
                Lee, investiga, aprende y conoce la historia de la obra de Lope de Vega
            </h2>
            <a href="#acerca-de" class="btn btn-dark btn-lg mt-5">
                SOBRE EL PROYECTO
            </a>
        </div>
    </div>
    <!-- Carrusel de imágenes con overlay de texto -->
    <div class="explore-carousel mt-5">
        <div class="carousel-track" id="carouselTrack">
            <!-- Card 1 -->
            <div class="explore-card">
                <img src="{{ '/assets/img/explore/edicion2009.jpg' | relative_url }}" alt="Edición divulgativa">
                <div class="explore-card-overlay">
                    <h3>Edición divulgativa</h3>
                    <p>Participa en la evaluación de las notas explicativas</p>
                </div>
            </div>
            <!-- Card 2 -->
                        <div class="explore-card">
                <img src="{{ '/assets/img/explore/archivo.jpg' | relative_url }}" alt="Archivo documental">
                <div class="explore-card-overlay">
                    <h3>Archivo documental</h3>
                    <p>Materiales históricos y testimoniales</p>
                </div>
            </div>
            <!-- Card 3 -->
            <div class="explore-card">
                <img src="{{ '/assets/img/explore/imagen2.jpg' | relative_url }}" alt="Participación ciudadana">
                <div class="explore-card-overlay">
                    <h3>Participación ciudadana</h3>
                    <p>Colabora en la construcción del conocimiento</p>
                </div>
            </div>
            <!-- Card 4 -->
            <div class="explore-card">
                <img src="{{ '/assets/img/explore/imagen4.jpg' | relative_url }}" alt="Recursos educativos">
                <div class="explore-card-overlay">
                    <h3>Recursos educativos</h3>
                    <p>Para estudiantes y docentes</p>
                </div>
            </div>
            <!-- Card 5 (opcional, añade más si necesitas) -->
            <div class="explore-card">
                <img src="{{ '/assets/img/explore/imagen5.jpg' | relative_url }}" alt="Investigación">
                <div class="explore-card-overlay">
                    <h3>Investigación abierta</h3>
                    <p>Datos y metodología transparentes</p>
                </div>
            </div>
        </div>
        <!-- Controles del carrusel (opcional) -->
        <button class="carousel-btn carousel-btn-prev" id="btnPrev" aria-label="Anterior">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
        <button class="carousel-btn carousel-btn-next" id="btnNext" aria-label="Siguiente">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
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
// Carrusel de exploración
document.addEventListener('DOMContentLoaded', function() {
    const track = document.getElementById('carouselTrack');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    
    if (!track || !btnPrev || !btnNext) return;

    const cardWidth = 320 + 24; // ancho de card + gap
    const scrollAmount = cardWidth * 2; // Scroll de 2 cards a la vez

    // Navegación con botones
    btnNext.addEventListener('click', () => {
        track.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });

    btnPrev.addEventListener('click', () => {
        track.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    });

    // Opcional: Ocultar botones cuando no hay más scroll
    track.addEventListener('scroll', () => {
        const maxScroll = track.scrollWidth - track.clientWidth;
        
        // Ocultar botón prev si estamos al inicio
        if (track.scrollLeft <= 10) {
            btnPrev.style.opacity = '0.3';
            btnPrev.style.pointerEvents = 'none';
        } else {
            btnPrev.style.opacity = '1';
            btnPrev.style.pointerEvents = 'auto';
        }

        // Ocultar botón next si estamos al final
        if (track.scrollLeft >= maxScroll - 10) {
            btnNext.style.opacity = '0.3';
            btnNext.style.pointerEvents = 'none';
        } else {
            btnNext.style.opacity = '1';
            btnNext.style.pointerEvents = 'auto';
        }
    });

    // Trigger inicial para configurar botones correctamente
    track.dispatchEvent(new Event('scroll'));
});

</script>