---
layout: default
title: Participa
permalink: /participa/
navbar_main_offset: false
---

<section class="participa-hero">
  <div class="participa-shell">
    <div class="row align-items-center participa-head">
      <div class="col-md-7 order-2 order-md-1">
        <div class="card card-soft p-3 p-lg-4">
          <h3 class="mb-2 text-uppercase">Tu voz construye esta historia</h3>
          <p class="mb-0">
            <i>Fuenteovejuna</i> es una obra viva que ha sido representada, leida, discutida y sentida por miles de personas durante cuatro siglos.
            Tu participacion es clave para construir una edicion social del texto y documentar su memoria colectiva.
          </p>
        </div>
      </div>
      <div class="col-md-5 order-1 order-md-2 text-center text-md-end">
        <h1 class="participa-title mb-0">PARTICIPA</h1>
      </div>
    </div>

    {% assign participa_cards = site.data.participa_cards %}
    <div class="row participa-cards">
      {% for card in participa_cards %}
        <div class="col-md-4">
          {% include cards/ta-card.html card=card context="participa" %}
        </div>
      {% endfor %}
    </div>

    <p class="text-center small mb-0 participa-footnote">
      Lee la <a href="{{ '/participa/guia/' | relative_url }}">guía de participación</a>,
      conoce más <a href="{{ '/acerca-de/' | relative_url }}">sobre el proyecto</a>
      y consulta la <a href="{{ '/privacidad/' | relative_url }}">política de privacidad</a>.
    </p>
  </div>
</section>
