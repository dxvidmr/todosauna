---
layout: default
title: Inicio
permalink: /
navbar_behavior: hidden-on-load
navbar_main_offset: false
custom-foot: js/home-explore-grid-js.html
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
  <div class="hero-scroll" onclick="if(window.NavbarBehavior) window.NavbarBehavior.showNavbar(); document.getElementById('explore-section').scrollIntoView({behavior: 'smooth'});">
    <span>Explorar el sitio</span>
    <i class="fa-solid fa-chevron-down"></i>
  </div>
</section>

<section id="explore-section" class="explore-section">
  <div class="explore-content">
    <h2 class="explore-title text-center">
      Descubre y <a href="{{ '/participa/' | relative_url }}" class="btn btn-primary explore-title-cta">participa</a> de la historia de <i>Fuenteovejuna</i>
    </h2>

    <div class="home-grid" data-home-grid>
      <a class="ta-card ta-card--media ta-card--link home-grid__item home-grid__item--leer" href="{{ '/lectura/' | relative_url }}">
        <img class="ta-card__media" src="{{ '/assets/img/explore/edicion2009.jpg' | relative_url }}" alt="Leer Fuenteovejuna con notas explicativas">
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Lectura</p>
          <h3 class="ta-card__title">Leer la obra</h3>
          <p class="ta-card__copy">Abre la edicion divulgativa y explora anotaciones para cada pasaje.</p>
        </div>
      </a>

      <article class="ta-card ta-card--color ta-card--interactive home-grid__item home-grid__item--eval" data-home-eval-card>
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Participa</p>
          <h3 class="ta-card__title">Evalua una nota</h3>
          <p class="ta-card__copy">Da feedback rapido sobre una nota activa sin salir del inicio.</p>
          <p class="home-eval-note" data-home-note-text>Cargando nota...</p>
          <p class="home-eval-note-id" data-home-note-id></p>
          <div class="home-eval-controls" data-home-eval-controls></div>
          <p class="home-eval-status" data-home-eval-status aria-live="polite"></p>
          <div class="home-eval-actions">
            <button class="btn btn-dark btn-sm" type="button" data-home-next-note hidden>Ver otra nota</button>
            <a class="btn btn-outline-dark btn-sm" href="{{ '/participa/laboratorio/' | relative_url }}">Ir al laboratorio</a>
          </div>
        </div>
      </article>

      <a class="ta-card ta-card--color ta-card--link home-grid__item home-grid__item--lab" href="{{ '/participa/laboratorio/' | relative_url }}">
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Participa</p>
          <h3 class="ta-card__title">Laboratorio de notas</h3>
          <p class="ta-card__copy">Recorre pasajes en modo secuencial o aleatorio y mejora la edicion colaborativa.</p>
        </div>
      </a>

      <a class="ta-card ta-card--media ta-card--link home-grid__item home-grid__item--documento" href="{{ '/participa/documentos/enviar/' | relative_url }}">
        <img class="ta-card__media" src="{{ '/assets/img/participa/archivos.jpg' | relative_url }}" alt="Subir documentos al archivo">
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Participa</p>
          <h3 class="ta-card__title">Comparte un documento</h3>
          <p class="ta-card__copy">Aporta programas, fotos, carteles o recortes de prensa.</p>
        </div>
      </a>

      <a class="ta-card ta-card--media ta-card--link home-grid__item home-grid__item--testimonio" href="{{ '/participa/testimonios/enviar/' | relative_url }}">
        <img class="ta-card__media" src="{{ '/assets/img/participa/platea.jpg' | relative_url }}" alt="Enviar testimonio personal">
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Participa</p>
          <h3 class="ta-card__title">Comparte tu testimonio</h3>
          <p class="ta-card__copy">Cuenta tu experiencia con Fuenteovejuna y sumala al archivo vivo.</p>
        </div>
      </a>

      <a class="ta-card ta-card--media ta-card--link home-grid__item home-grid__item--archivo" href="{{ '/archivo/documentos/' | relative_url }}" data-home-rotator-card>
        <img
          class="ta-card__media home-rotator-image"
          src="{{ '/assets/img/explore/archivo.jpg' | relative_url }}"
          alt="Archivo documental de Fuenteovejuna"
          data-home-rotator-image
          data-rotator-sources="{{ '/assets/img/explore/archivo.jpg' | relative_url }}|{{ '/assets/img/explore/experiencias.jpg' | relative_url }}|{{ '/assets/img/explore/impreso.jpg' | relative_url }}"
          data-rotator-alts="Archivo documental de Fuenteovejuna|Memoria escenica y recepcion|Ediciones y materiales impresos"
        >
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Archivo</p>
          <h3 class="ta-card__title">Archivo documental</h3>
          <p class="ta-card__copy">Explora materiales historicos con una vista dinamica del fondo disponible.</p>
        </div>
      </a>

      <a class="ta-card ta-card--color ta-card--link home-grid__item home-grid__item--memoria" href="{{ '/archivo/testimonios/' | relative_url }}">
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Archivo</p>
          <h3 class="ta-card__title">Archivo de la memoria</h3>
          <p class="ta-card__copy">Lee testimonios publicados y filtra por contexto, ciudad o experiencia.</p>
        </div>
      </a>

      <article class="ta-card ta-card--color home-grid__item home-grid__item--viz">
        <div class="ta-card__body">
          <p class="ta-card__eyebrow">Visualizaciones</p>
          <h3 class="ta-card__title">Linea de tiempo y mapa</h3>
          <p class="ta-card__copy">Navega el archivo por cronologia o por geografia de representaciones y documentos.</p>
          <div class="ta-card__actions">
            <a class="btn btn-outline-dark btn-sm" href="{{ '/timeline.html' | relative_url }}">Linea de tiempo</a>
            <a class="btn btn-outline-dark btn-sm" href="{{ '/map.html' | relative_url }}">Mapa</a>
          </div>
        </div>
      </article>

      <a class="ta-card ta-card--pill home-grid__item home-grid__item--about" href="{{ '/acerca-de/' | relative_url }}">
        Sobre el proyecto
      </a>
    </div>
  </div>
</section>
