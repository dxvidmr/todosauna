---
layout: default
title: Enviar testimonio
permalink: /participa/testimonios/enviar/
navbar_main_offset: false
custom-foot: participacion/scripts-testimonio-form.html
---

<section class="participa-form-page participa-form-page--testimonio">
  <div class="participa-form-shell">
    <header class="participa-form-header card card-soft p-3 p-md-4">
      <p class="participa-form-eyebrow mb-2">Participa · Testimonios</p>
      <h1 class="mb-2">Comparte tu testimonio</h1>
      <p class="mb-0">
        Tu experiencia con <i>Fuenteovejuna</i> ayuda a construir una memoria colectiva de la obra.
        Puedes enviar un testimonio de forma anónima o como colaborador/a.
      </p>
    </header>

    <section id="participa-mode-gate-testimonio" class="participa-mode-gate" hidden>
      <p class="mb-2">Antes de enviar, define tu modo de participación.</p>
      <button type="button" id="btn-definir-modo-testimonio" class="btn btn-dark btn-sm">Elegir modo de participación</button>
    </section>

    <form id="testimonio-form" class="participa-form card card-soft p-3 p-md-4" novalidate>
      <input type="hidden" id="testimonio-linked-contribucion-id" value="">

      <fieldset class="participa-fieldset">
        <legend>Contenido</legend>
        <div class="mb-3">
          <label for="testimonio-titulo" class="form-label">Título *</label>
          <input type="text" class="form-control" id="testimonio-titulo" maxlength="160" required>
        </div>
        <div class="mb-0">
          <label for="testimonio-texto" class="form-label">Testimonio (admite Markdown) *</label>
          <textarea class="form-control" id="testimonio-texto" rows="7" required></textarea>
        </div>
      </fieldset>

      <fieldset class="participa-fieldset">
        <legend>Contexto (opcional)</legend>
        <div class="row g-3">
          <div class="col-md-6">
            <label for="testimonio-fecha" class="form-label">Fecha exacta</label>
            <input type="date" class="form-control" id="testimonio-fecha">
          </div>
          <div class="col-md-6">
            <label for="testimonio-fecha-texto" class="form-label">Fecha explicativa</label>
            <input type="text" class="form-control" id="testimonio-fecha-texto" maxlength="120" placeholder="Ej.: Verano de 1998, durante una gira escolar">
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-md-7">
            <label for="testimonio-experiencia-ciudad" class="form-label">Ciudad (GeoNames)</label>
            <div class="participa-geonames-field">
              <input type="text" class="form-control" id="testimonio-experiencia-ciudad" autocomplete="off" placeholder="Empieza a escribir una ciudad">
              <button type="button" class="btn btn-outline-secondary btn-sm" id="testimonio-limpiar-ciudad">Limpiar</button>
            </div>
            <input type="hidden" id="testimonio-experiencia-ciudad-nombre">
            <input type="hidden" id="testimonio-experiencia-ciudad-id">
          </div>
          <div class="col-md-5">
            <label for="testimonio-experiencia-pais" class="form-label">País (automático)</label>
            <input type="text" class="form-control" id="testimonio-experiencia-pais" readonly>
            <input type="hidden" id="testimonio-experiencia-pais-nombre">
            <input type="hidden" id="testimonio-experiencia-pais-id">
          </div>
        </div>

        <div class="mt-3">
          <label for="testimonio-lugar-texto" class="form-label">Lugar explicativo</label>
          <input type="text" class="form-control" id="testimonio-lugar-texto" maxlength="160" placeholder="Ej.: Teatro municipal, patio del instituto...">
        </div>

        <div class="row g-3 mt-1">
          <div class="col-md-6">
            <label for="testimonio-contexto" class="form-label">Contexto</label>
            <select class="form-select" id="testimonio-contexto">
              <option value="">Selecciona una opción</option>
              <option value="personal">Personal</option>
              <option value="academico">Académico</option>
              <option value="profesional">Profesional</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="col-md-6">
            <label for="testimonio-rango-edad" class="form-label">Rango de edad en ese momento</label>
            <select class="form-select" id="testimonio-rango-edad">
              <option value="">Selecciona una opción</option>
              <option value="menos_de_18">Menos de 18</option>
              <option value="18_25">18-25</option>
              <option value="26_35">26-35</option>
              <option value="36_50">36-50</option>
              <option value="51_65">51-65</option>
              <option value="mas_de_65">Más de 65</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset class="participa-fieldset">
        <legend>Vínculos y privacidad</legend>
        <div class="mb-3">
          <label for="testimonio-linked-refs" class="form-label">Vínculos a objetos del archivo (opcional)</label>
          <textarea class="form-control" id="testimonio-linked-refs" rows="3" placeholder="Un enlace o ID por línea"></textarea>
        </div>

        <div class="participa-privacy-grid">
          <label><input type="checkbox" id="privacy-mostrar-nombre"> Mostrar mi nombre público (si tengo perfil)</label>
          <label><input type="checkbox" id="privacy-mostrar-fecha"> Mostrar fecha</label>
          <label><input type="checkbox" id="privacy-mostrar-ciudad"> Mostrar ciudad</label>
          <label><input type="checkbox" id="privacy-mostrar-pais"> Mostrar país</label>
          <label><input type="checkbox" id="privacy-mostrar-lugar-texto"> Mostrar lugar explicativo</label>
          <label><input type="checkbox" id="privacy-mostrar-contexto"> Mostrar contexto</label>
          <label><input type="checkbox" id="privacy-mostrar-rango-edad"> Mostrar rango de edad</label>
        </div>

        <div class="form-check mt-3">
          <input class="form-check-input" type="checkbox" value="1" id="testimonio-consent" required>
          <label class="form-check-label" for="testimonio-consent">
            Acepto la política de privacidad para este envío. *
          </label>
        </div>
      </fieldset>

      <div id="testimonio-form-status" class="participa-form-status" aria-live="polite"></div>

      <div class="participa-form-actions">
        <button type="submit" id="btn-enviar-testimonio" class="btn btn-dark">Enviar testimonio</button>
      </div>
    </form>

    <section id="testimonio-success" class="participa-success card card-soft p-3 p-md-4" hidden>
      <h2 class="h4 mb-2">¡Testimonio enviado con éxito!</h2>
      <p class="mb-2">Hemos recibido tu testimonio. Muchas gracias por participar en el proyecto.</p>
      <p class="mb-3">El ID de tu envío es <code id="testimonio-success-id"></code>. Puedes guardarlo por si más adelante quieres hacer alguna consulta.</p>
      <div id="testimonio-link-status" class="participa-form-status"></div>
      <div class="participa-form-actions">
        <a id="testimonio-cta-documento" href="{{ '/participa/documentos/enviar/' | relative_url }}" class="btn btn-dark">Añadir un documento vinculado</a>
        <a href="{{ '/participa/' | relative_url }}" class="btn btn-outline-dark">Volver a Participa</a>
      </div>
    </section>
  </div>
</section>

