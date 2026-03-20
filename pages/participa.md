---
layout: page
title: Participa
permalink: /participa/
---

<section class="py-2 py-md-3">
  <div class="row justify-content-center mb-4 mb-md-5">
    <div class="col-lg-10 text-center">
      <h1 class="display-5 fw-semibold mb-3">Participa en <i>Todos a una</i></h1>
      <p class="lead mb-0">
        Tu colaboración ayuda a construir una edicion social del texto y a documentar su historias.
      </p>
    </div>
  </div>

  {% assign participa_cards = site.data.participa_cards %}
  <div class="ta-grid">
    {% for card in participa_cards %}
      {% include cards/ta-card.html card=card context="grid" %}
    {% endfor %}
  </div>

  <p class="text-center small text-muted mt-4 mb-0">
    Lee la <a href="{{ '/participa/guia/' | relative_url }}">guia de participacion</a>,
    conoce mas <a href="{{ '/acerca-de/' | relative_url }}">sobre el proyecto</a>
    y consulta la <a href="{{ '/privacidad/' | relative_url }}">politica de privacidad</a>.
  </p>
</section>
