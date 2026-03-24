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
    <p class="hero-subtitle">Descubre y participa de la historia de <i>Fuenteovejuna</i>, la obra de teatro de Lope de Vega.</p>
  </div>
  <div class="hero-scroll" onclick="if(window.NavbarBehavior) window.NavbarBehavior.showNavbar(); document.getElementById('explore-section').scrollIntoView({behavior: 'smooth'});">
    <span></span>
    <i class="fa-solid fa-chevron-down"></i>
  </div>
</section>

<section id="explore-section" class="explore-section">
  <div class="explore-content">
    <h2 class="explore-title text-center">
      Explora el sitio
    </h2>

    {% assign home_cards = site.data.home_cards | sort: "order_desktop" %}
    <div class="ta-grid" data-home-grid>
      {% for card in home_cards %}
        {% include cards/ta-card.html card=card context="home" %}
      {% endfor %}
    </div>
  </div>
</section>
