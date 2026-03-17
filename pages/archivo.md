---
layout: page
title: Archivo
permalink: /archivo/
---

<section class="py-2 py-md-3">
  <div class="row justify-content-center mb-4 mb-md-5">
    <div class="col-lg-10 text-center">
      <h1 class="display-5 fw-semibold mb-3">Archivo <i>Fuenteovejuna</i></h1>
      <p class="lead mb-0">
        Descubre la historia de <i>Fuenteovejuna</i> a partir de materiales documentales y de testimonios personales.
      </p>
    </div>
  </div>

  {% assign archivo_cards = site.data.archivo_cards %}
  <div class="ta-grid ta-cards">
    {% for card in archivo_cards %}
      {% include cards/ta-card.html card=card context="grid" %}
    {% endfor %}
  </div>
</section>
