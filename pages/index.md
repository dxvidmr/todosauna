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
    <p class="hero-kicker">FUENTEOVEJUNA</p>
    <h1 class="hero-title">
      TODOS A UNA
    </h1>
    <div class="hero-image">
      <img src="{{ '/assets/img/hero/hero.jpg' | relative_url }}" alt="Fuenteovejuna">
    </div>
    <p class="hero-subtitle">Descubre y participa de la historia de <i>Fuenteovejuna</i>, la obra de teatro de Lope de Vega.</p>
  </div>
  <div class="hero-scroll" onclick="if(window.NavbarBehavior) window.NavbarBehavior.showNavbar(); (document.getElementById('home-feature-sections') || document.getElementById('explore-section')).scrollIntoView({behavior: 'smooth'});">
    <span></span>
    <i class="fa-solid fa-chevron-down"></i>
  </div>
</section>

{% assign home_feature_sections = site.data.home_feature_sections | where: "enabled", true %}
{% if home_feature_sections.size > 0 %}
<section id="home-feature-sections" class="home-feature-sections" aria-label="Secciones destacadas">
  <div class="home-feature-sections__inner">
    {% for section in home_feature_sections %}
      {% assign image_position = section.image_position | default: "right" %}
      {% assign section_image_value = section.image | default: "" | strip %}
      {% assign section_image_src = section_image_value %}
      {% assign section_image_alt = section.image_alt | default: section.title %}
      {% assign section_image_item = site.data[site.metadata] | where: "objectid", section_image_value | first %}
      {% if section_image_item %}
        {% assign section_image_src = section_image_item.image_small | default: section_image_item.image_thumb | default: section_image_item.object_location | default: section_image_value %}
        {% assign explicit_image_alt = section.image_alt | default: "" | strip %}
        {% if explicit_image_alt == "" %}
          {% assign section_image_alt = section_image_item.image_alt_text | default: section_image_item.description | default: section_image_item.title | default: section.title %}
        {% endif %}
      {% endif %}
      <article class="home-feature{% if image_position == 'left' %} home-feature--image-left{% endif %}">
        <div class="home-feature__copy">
          <h2 class="home-feature__title">{{ section.title }}</h2>
          {% assign section_text = section.text | replace: "<br />", "<br>" | replace: "<br/>", "<br>" %}
          {% assign section_paragraphs = section_text | split: "<br>" %}
          <div class="home-feature__text">
            {% for paragraph in section_paragraphs %}
              {% assign paragraph_text = paragraph | strip %}
              {% if paragraph_text != "" %}
                {{ paragraph_text | markdownify }}
              {% endif %}
            {% endfor %}
          </div>
          {% if section.action_label and section.action_url %}
            <div class="home-feature__actions">
              <a class="btn btn-dark" href="{{ section.action_url | relative_url }}">{{ section.action_label }}</a>
            </div>
          {% endif %}
        </div>
        {% if section_image_src != "" %}
          <figure class="home-feature__media">
            <img src="{{ section_image_src | relative_url }}" alt="{{ section_image_alt | escape }}">
          </figure>
        {% endif %}
      </article>
    {% endfor %}
  </div>
</section>
{% endif %}

<section id="explore-section" class="explore-section">
  <div class="explore-content">
    <h2 class="explore-title text-center">
      Explora todas las secciones
    </h2>

    {% assign home_cards = site.data.home_cards | sort: "order_desktop" %}
    <div class="ta-grid" data-home-grid>
      {% for card in home_cards %}
        {% include cards/ta-card.html card=card context="home" %}
      {% endfor %}
    </div>
  </div>
</section>
