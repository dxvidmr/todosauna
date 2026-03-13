---
layout: default
title: Enviar testimonio
permalink: /participa/testimonios/enviar/
navbar_main_offset: false
custom-foot: participacion/scripts-testimonio-form.html
---

<section class="participa-form-page participa-form-page--testimonio">
  <div class="participa-form-shell">
    <header class="participa-form-header card card-soft ui-thin-border p-3 p-md-4">
      <p class="ui-eyebrow mb-2">Participa · Testimonios</p>
      <h1 class="mb-2">Comparte tu testimonio</h1>
      <p class="mb-0">
        Tu experiencia con <i>Fuenteovejuna</i> ayuda a construir una memoria colectiva de la obra.
        Puedes enviar un testimonio de forma anónima o como colaborador/a.
      </p>
    </header>

    <section id="participa-mode-gate-testimonio" class="participa-mode-gate" hidden>
      <p class="mb-2">Antes de enviar, define tu modo de participación.</p>
      <button type="button" id="btn-definir-modo-testimonio" class="btn btn-secondary btn-sm">Elegir modo de participación</button>
    </section>

    <form id="testimonio-form" class="participa-form card card-soft" novalidate>
      <input type="hidden" id="testimonio-linked-contribucion-id" value="">

      <fieldset class="participa-fieldset">
        <legend>Contenido</legend>
        <div class="mb-3">
          <label for="testimonio-titulo" class="form-label">Título <span class="required-mark" aria-hidden="true">*</span></label>
          <input type="text" class="form-control" id="testimonio-titulo" maxlength="160" required>
        </div>
        <div class="mb-0">
          <label for="testimonio-texto" class="form-label">Testimonio (admite Markdown) <span class="required-mark" aria-hidden="true">*</span></label>
          <textarea class="form-control" id="testimonio-texto" rows="7" required></textarea>
        </div>
      </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Contexto <span class="optional-note">(opcional)</span></legend>
          <small class="field-helper field-helper--intro">Añade el contexto que ayude a entender tu experiencia. Completa solo lo que quieras compartir.</small>
          <div class="row g-3">
            <div class="col-md-6">
              <label for="testimonio-fecha" class="form-label">Fecha de la experiencia (si la recuerdas)</label>
              <input type="date" class="form-control" id="testimonio-fecha">
            </div>
            <div class="col-md-6">
              <label for="testimonio-fecha-texto" class="form-label">Fecha aproximada o contexto temporal</label>
              <input type="text" class="form-control" id="testimonio-fecha-texto" maxlength="120" placeholder="Ej.: Verano de 1998, durante una gira escolar">
            </div>
          </div>

          <p class="field-group-title mt-3 mb-2">Ciudad y país de referencia</p>
          <div class="geo-location-row geo-location-row--full mt-1">
            <div>
              <label for="testimonio-experiencia-ciudad" class="form-label">Ciudad de referencia</label>
              <div class="participa-geonames-field">
                <input type="text" class="form-control" id="testimonio-experiencia-ciudad" autocomplete="off" placeholder="Empieza a escribir una ciudad">
              </div>
              <input type="hidden" id="testimonio-experiencia-ciudad-nombre">
              <input type="hidden" id="testimonio-experiencia-ciudad-id">
            </div>
            <div>
              <label for="testimonio-experiencia-pais" class="form-label">País de referencia (automático)</label>
              <input type="text" class="form-control" id="testimonio-experiencia-pais" readonly>
              <input type="hidden" id="testimonio-experiencia-pais-nombre">
              <input type="hidden" id="testimonio-experiencia-pais-id">
            </div>
            <button type="button" class="btn btn-outline-dark btn-sm" id="testimonio-limpiar-ciudad">Limpiar</button>
          </div>
          <small class="field-helper">Opcional. Si escribes ciudad, selecciona una opción de la lista GeoNames.</small>

          <div class="mt-3">
            <label for="testimonio-lugar-texto" class="form-label">Lugar concreto de la experiencia (texto libre)</label>
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
          <label for="testimonio-linked-refs" class="form-label">Vínculos a objetos del archivo <span class="optional-note">(opcional)</span></label>
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
            Acepto la <a href="{{ '/privacidad/' | relative_url }}" target="_blank" rel="noopener noreferrer">política de privacidad</a> para este envío.
            <span class="required-mark" aria-hidden="true">*</span>
          </label>
        </div>
      </fieldset>

      <div id="testimonio-form-status" class="participa-form-status" aria-live="polite"></div>

      <div class="participa-form-actions">
        <button type="submit" id="btn-enviar-testimonio" class="btn btn-primary">Enviar testimonio</button>
      </div>
    </form>

    <section id="testimonio-success" class="participa-success card card-soft ui-thin-border p-3 p-md-4" hidden>
      <h2 class="h4 mb-2">¡Testimonio enviado con éxito!</h2>
      <p class="mb-2">Hemos recibido tu testimonio. Muchas gracias por participar en el proyecto.</p>
      <p class="mb-3">El ID de tu envío es <code id="testimonio-success-id"></code>. Puedes guardarlo por si más adelante quieres hacer alguna consulta.</p>
      <div id="testimonio-link-status" class="participa-form-status"></div>
      <div class="participa-form-actions">
        <a id="testimonio-cta-documento" href="{{ '/participa/documentos/enviar/' | relative_url }}" class="btn btn-secondary">Añadir un documento vinculado</a>
        <a href="{{ '/participa/' | relative_url }}" class="btn btn-outline-dark">Volver a Participa</a>
      </div>
    </section>
  </div>
</section>
