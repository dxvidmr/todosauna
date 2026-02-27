---
title: Archivo de la memoria
layout: default
permalink: /archivo/testimonios/
navbar_behavior: fixed
custom-foot: participacion/scripts-testimonios-publicos.html
---

<section class="archivo-testimonios-page" id="archivo-testimonios-page" data-csv-url="{{ '/assets/data/testimonios-export.csv' | relative_url }}" data-items-base="{{ '/items/' | relative_url }}">
  <div class="archivo-testimonios-shell">
    <header class="archivo-testimonios-header card card-soft p-3 p-md-4">
      <p class="archivo-testimonios-eyebrow mb-2">Archivo · Testimonios</p>
      <h1 class="mb-2">Archivo de la memoria</h1>
      <p class="mb-0">
        Descubre testimonios publicados de lectoras, lectores, investigadoras, investigadores y comunidades
        vinculadas a <i>Fuenteovejuna</i>.
      </p>
    </header>

    <section class="archivo-testimonios-controls card card-soft p-3">
      <div class="row g-3">
        <div class="col-md-8">
          <label for="testimonios-publicos-search" class="form-label mb-1">Buscar en testimonios</label>
          <input
            type="search"
            id="testimonios-publicos-search"
            class="form-control"
            placeholder="Título, texto, autor, ciudad, país..."
            autocomplete="off"
          >
        </div>
        <div class="col-md-4">
          <label for="testimonios-publicos-context" class="form-label mb-1">Filtrar por contexto</label>
          <select id="testimonios-publicos-context" class="form-select">
            <option value="">Todos</option>
            <option value="personal">Personal</option>
            <option value="academico">Académico</option>
            <option value="profesional">Profesional</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>
      <div class="archivo-testimonios-controls-actions">
        <button type="button" id="testimonios-publicos-clear" class="btn btn-outline-dark btn-sm">Limpiar filtros</button>
        <p id="testimonios-publicos-summary" class="archivo-testimonios-summary mb-0" aria-live="polite"></p>
      </div>
    </section>

    <div id="testimonios-publicos-loading" class="archivo-testimonios-status" hidden>
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Cargando testimonios...
    </div>

    <div id="testimonios-publicos-error" class="archivo-testimonios-status is-error" hidden></div>

    <div id="testimonios-publicos-empty" class="archivo-testimonios-status is-empty" hidden>
      No se encontraron testimonios para los filtros seleccionados.
    </div>

    <div id="testimonios-publicos-list" class="archivo-testimonios-grid" aria-live="polite" aria-busy="false"></div>

    <div class="archivo-testimonios-actions">
      <button type="button" id="testimonios-publicos-load-more" class="btn btn-dark" hidden>Cargar más</button>
    </div>
  </div>
</section>
