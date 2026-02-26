---
layout: default
title: Enviar aporte documental
permalink: /participa/documentos/enviar/
navbar_main_offset: false
custom-foot: participacion/scripts-contribucion-form.html
---

<section class="participa-form-page participa-form-page--documento">
  <div class="participa-form-shell">
    <header class="participa-form-header card card-soft p-3 p-md-4">
      <p class="participa-form-eyebrow mb-2">Participa - Archivo documental</p>
      <h1 class="mb-2">Comparte un documento</h1>
      <p class="mb-0">
        Puedes enviar fotos, programas, ediciones, manuscritos y otros materiales relacionados con <i>Fuenteovejuna</i>.
        El envio puede ser anonimo o como colaborador/a.
      </p>
    </header>

    <section id="participa-mode-gate-documento" class="participa-mode-gate" hidden>
      <p class="mb-2">Antes de enviar, define tu modo de participacion.</p>
      <button type="button" id="btn-definir-modo-documento" class="btn btn-dark btn-sm">Elegir modo de participacion</button>
    </section>

    <form id="contribucion-form" class="participa-form card card-soft p-3 p-md-4" novalidate>
      <input type="hidden" id="contribucion-linked-testimonio-id" value="">
      <input type="hidden" id="contribucion-staging-id" value="">

      <div class="participa-steps mb-3">
        <span class="participa-step is-active" data-step="1">1. Metadatos y derechos</span>
        <span class="participa-step" data-step="2">2. Subida y envio</span>
      </div>

      <section id="contribucion-step-1">
        <fieldset class="participa-fieldset">
          <legend>Datos del documento</legend>
          <div class="mb-3">
            <label for="contribucion-titulo" class="form-label">Titulo *</label>
            <input type="text" class="form-control" id="contribucion-titulo" maxlength="180" required>
          </div>
          <div class="mb-3">
            <label for="contribucion-descripcion" class="form-label">Descripcion</label>
            <textarea class="form-control" id="contribucion-descripcion" rows="4" maxlength="3000"></textarea>
          </div>
          <div class="mb-0">
            <label for="contribucion-creadores" class="form-label">Creadores y roles</label>
            <textarea class="form-control" id="contribucion-creadores" rows="3" placeholder="Nombre | rol (una linea por creador)"></textarea>
          </div>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Contexto (opcional)</legend>
          <div class="row g-3">
            <div class="col-md-6">
              <label for="contribucion-fecha" class="form-label">Fecha exacta</label>
              <input type="date" class="form-control" id="contribucion-fecha">
            </div>
            <div class="col-md-6">
              <label for="contribucion-fecha-texto" class="form-label">Fecha explicativa</label>
              <input type="text" class="form-control" id="contribucion-fecha-texto" maxlength="120" placeholder="Ej.: Primavera de 1986, gira escolar">
            </div>
          </div>

          <div class="row g-3 mt-1">
            <div class="col-md-7">
              <label for="contribucion-ciudad" class="form-label">Ciudad (GeoNames)</label>
              <div class="participa-geonames-field">
                <input type="text" class="form-control" id="contribucion-ciudad" autocomplete="off" placeholder="Empieza a escribir una ciudad">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="contribucion-limpiar-ciudad">Limpiar</button>
              </div>
              <input type="hidden" id="contribucion-ciudad-nombre">
              <input type="hidden" id="contribucion-ciudad-id">
            </div>
            <div class="col-md-5">
              <label for="contribucion-pais" class="form-label">Pais (automatico)</label>
              <input type="text" class="form-control" id="contribucion-pais" readonly>
              <input type="hidden" id="contribucion-pais-nombre">
              <input type="hidden" id="contribucion-pais-id">
            </div>
          </div>

          <div class="mt-3">
            <label for="contribucion-lugar-texto" class="form-label">Lugar explicativo</label>
            <input type="text" class="form-control" id="contribucion-lugar-texto" maxlength="160" placeholder="Ej.: Teatro municipal, archivo familiar...">
          </div>

          <div class="mt-3">
            <label for="contribucion-linked-refs" class="form-label">Vinculos con objetos ya existentes (opcional)</label>
            <textarea class="form-control" id="contribucion-linked-refs" rows="3" placeholder="Un enlace o ID por linea"></textarea>
          </div>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Derechos</legend>
          <div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="contribucion-rights-type" id="contribucion-rights-cc" value="cc_by_nc_sa">
            <label class="form-check-label" for="contribucion-rights-cc">
              Puedo ceder licencia abierta CC-BY-NC-SA
            </label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="contribucion-rights-type" id="contribucion-rights-copyright" value="copyright">
            <label class="form-check-label" for="contribucion-rights-copyright">
              Mantengo copyright (debo indicar titular)
            </label>
          </div>
          <div id="rights-holder-wrap" class="mt-3" hidden>
            <label for="contribucion-rights-holder" class="form-label">Titular del copyright</label>
            <input type="text" class="form-control" id="contribucion-rights-holder" maxlength="160">
          </div>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Consentimiento</legend>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" value="1" id="contribucion-consent" required>
            <label class="form-check-label" for="contribucion-consent">
              Acepto la politica de privacidad para este envio. *
            </label>
          </div>
        </fieldset>

        <div id="contribucion-step1-status" class="participa-form-status" aria-live="polite"></div>

        <div class="participa-form-actions mt-3">
          <button type="button" id="btn-contribucion-next" class="btn btn-dark">Continuar</button>
        </div>
      </section>

      <section id="contribucion-step-2" hidden>
        <fieldset class="participa-fieldset">
          <legend>Archivos</legend>
          <div class="mb-3">
            <label for="contribucion-archivos-locales" class="form-label">Selecciona archivos (max. 10 - 20MB por archivo)</label>
            <input type="file" class="form-control" id="contribucion-archivos-locales" multiple accept=".pdf,image/jpeg,image/jpg,image/png,image/webp,image/tiff">
          </div>
          <div id="contribucion-recaptcha-wrap" class="mb-3">
            <p class="small mb-2">Validacion anti-bot (reCAPTCHA)</p>
            <div id="contribucion-recaptcha-widget"></div>
          </div>
          <div class="participa-form-actions">
            <button type="button" id="btn-contribucion-subir" class="btn btn-dark">Subir archivos</button>
            <button type="button" id="btn-contribucion-cancelar-subida" class="btn btn-outline-dark">Cancelar subida</button>
          </div>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Archivos listos para envio</legend>
          <ul id="contribucion-archivos-subidos-lista" class="list-group mb-0"></ul>
        </fieldset>

        <div id="contribucion-step2-status" class="participa-form-status" aria-live="polite"></div>

        <div class="participa-form-actions mt-3">
          <button type="button" id="btn-contribucion-prev" class="btn btn-outline-dark">Volver</button>
          <button type="submit" id="btn-enviar-contribucion" class="btn btn-dark">Enviar contribucion</button>
        </div>
      </section>
    </form>

    <section id="contribucion-success" class="participa-success card card-soft p-3 p-md-4" hidden>
      <h2 class="h4 mb-2">¡Contribución enviada con éxito!</h2>
      <p class="mb-2">Hemos recibido tu aporte. Muchas gracias por participar en el proyecto.</p>
      <p class="mb-3">El ID de tu envío es <code id="contribucion-success-id"></code>. Puedes anotarlo por si más adelante quieres hacer alguna consulta.</p>
      <div id="contribucion-link-status" class="participa-form-status"></div>
      <div class="participa-form-actions">
        <a id="contribucion-cta-testimonio" href="{{ '/participa/testimonios/enviar/' | relative_url }}" class="btn btn-dark">Añadir un testimonio vinculado</a>
        <a href="{{ '/participa/' | relative_url }}" class="btn btn-outline-dark">Volver a Participa</a>
      </div>
    </section>
  </div>
</section>
