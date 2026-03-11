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

    {% assign home_cards = site.data.home_cards | sort: "order_desktop" %}
    <div class="home-grid" data-home-grid>
      {% for card in home_cards %}
        {% include cards/ta-card.html card=card context="home" %}
      {% endfor %}
    </div>
  </div>
</section>
