---
layout: default
title: Inicio
permalink: /
navbar_behavior: hidden-on-load
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
    <div class="hero-scroll" onclick="if(window.NavbarBehavior) window.NavbarBehavior.showNavbar(); document.getElementById('explore-section').scrollIntoView({behavior: 'smooth'});">
        <span>Explorar el sitio</span>
        <i class="fa-solid fa-chevron-down"></i>
    </div>
</section>

<!-- Sección de exploración con carrusel -->
<section id="explore-section" class="explore-section">
    <div class="explore-content text-center ms-3 me-3">
        <!--<p class="explore-badge">TODOS A UNA</p>-->
        <h2 class="explore-title mx-2 mx-md-4">
            Explora la obra, colabora en la edición y descubre la historia de <i>Fuenteovejuna</i>
        </h2>
        <a href="#acerca-de" class="btn btn-dark btn-lg mt-5">
            SOBRE EL PROYECTO
        </a>
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
    </div>
</section>

<!-- El comportamiento del navbar se maneja centralizadamente en navbar-behavior.js -->