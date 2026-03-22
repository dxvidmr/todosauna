---
layout: default
title: Enviar aporte documental
permalink: /participa/documentos/enviar/
navbar_main_offset: false
custom-foot: participacion/scripts-contribucion-form.html
---

<section class="participa-form-page participa-form-page--documento">
  <div class="participa-form-shell">
    <header class="participa-form-header card card-soft ui-thin-border p-3 p-md-4">
      <p class="ui-eyebrow mb-2">Participa · Colección documental</p>
      <h1 class="mb-2">Comparte un documento</h1>
      <p class="mb-0">
        Puedes enviar fotos, programas, ediciones, manuscritos y otros materiales relacionados con <i>Fuenteovejuna</i>.
      </p>
    </header>

    <section id="participa-mode-gate-documento" class="participa-mode-gate" hidden>
      <p class="mb-2">Antes de enviar, define tu modo de participación.</p>
      <button type="button" id="btn-definir-modo-documento" class="btn btn-secondary-100 btn-sm">Elegir modo de participación</button>
    </section>

    <form id="contribucion-form" class="participa-form" novalidate>
      <input type="hidden" id="contribucion-linked-testimonio-id" value="">
      <input type="hidden" id="contribucion-staging-id" value="">

      <div class="participa-steps mb-3">
        <span class="participa-step is-active" data-step="1">1. Datos del documento</span>
        <span class="participa-step" data-step="2">2. Archivos, derechos y envío</span>
      </div>

      <section id="contribucion-step-1">
        <fieldset class="participa-fieldset">
          <legend>Datos del documento</legend>
          <small class="field-helper field-helper--intro">Incluye la información mínima para poder identificar, catalogar y revisar el documento.</small>
          <div class="mb-3">
            <label for="contribucion-titulo" class="form-label">Título <span class="required-mark" aria-hidden="true">*</span></label>
            <input type="text" class="form-control" id="contribucion-titulo" maxlength="180" placeholder="Ej.: Programa de mano de Fuenteovejuna (Madrid, 1986)" required>
          </div>
          <div class="mb-3">
            <label for="contribucion-descripcion" class="form-label">Descripción <span class="optional-note">(opcional)</span></label>
            <textarea class="form-control" id="contribucion-descripcion" rows="4" maxlength="3000" placeholder="Qué es el documento, de dónde procede y por qué puede ser relevante."></textarea>
          </div>
          <div class="mb-0">
            <label class="form-label">Creadores y roles <span class="optional-note">(opcional)</span></label>
            <div id="contribucion-creadores-list" class="creator-list">
              <div class="creator-row" data-creator-row>
                <div class="creator-row-field creator-row-field--name">
                  <label class="form-label mb-1" for="contribucion-creador-nombre-1">Nombre</label>
                  <input type="text" class="form-control" id="contribucion-creador-nombre-1" data-creator-name maxlength="160" placeholder="Ej.: María Pérez">
                </div>
                <div class="creator-row-field creator-row-field--role">
                  <label class="form-label mb-1" for="contribucion-creador-rol-1">Rol</label>
                  <input type="text" class="form-control" id="contribucion-creador-rol-1" data-creator-role maxlength="160" placeholder="Ej.: dramaturga">
                </div>
                <button type="button" class="btn btn-outline-dark btn-sm" data-creator-remove hidden>Quitar</button>
              </div>
            </div>
            <div class="participa-form-actions mt-2">
              <button type="button" id="btn-contribucion-add-creador" class="btn btn-outline-dark btn-sm">Añadir creador</button>
            </div>
            <small class="field-helper">Puedes añadir tantos creadores como necesites.</small>
          </div>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Contexto <span class="optional-note">(opcional)</span></legend>
          <small class="field-helper field-helper--intro">Añade la información de contexto que ayude a situar y comprender el documento.</small>
          <p class="field-group-title mb-2 mt-5">Localización temporal</p>
          <div class="row g-3">
            <div class="col-md-5">
              <label for="contribucion-fecha" class="form-label">Fecha exacta <span class="optional-note">(si se conoce)</span></label>
              <input type="date" class="form-control" id="contribucion-fecha">
            </div>
            <div class="col-md-7">
              <label for="contribucion-fecha-texto" class="form-label">Fecha aproximada o contexto temporal</label>
              <input type="text" class="form-control" id="contribucion-fecha-texto" maxlength="120" placeholder="Ej.: Primavera de 1986, gira escolar">
            </div>
          </div>

          <p class="field-group-title mt-5 mb-2">Localización espacial</p>
          <div class="geo-location-row geo-location-row--full mt-1">
            <div>
              <label for="contribucion-ciudad" class="form-label">Ciudad de referencia</label>
              <div class="participa-geonames-field">
                <input type="text" class="form-control" id="contribucion-ciudad" autocomplete="off" placeholder="Empieza a escribir una ciudad">
              </div>
              <input type="hidden" id="contribucion-ciudad-nombre">
              <input type="hidden" id="contribucion-ciudad-id">
            </div>
            <div>
              <label for="contribucion-pais" class="form-label">País de referencia <span class="optional-note">(automático)</span></label>
              <input type="text" class="form-control" id="contribucion-pais" readonly>
              <input type="hidden" id="contribucion-pais-nombre">
              <input type="hidden" id="contribucion-pais-id">
            </div>
            <button type="button" class="btn btn-outline-dark btn-sm" id="contribucion-limpiar-ciudad">Limpiar</button>
          </div>
          <small class="field-helper">Selecciona una opción de la lista.</small>

          <div class="mt-3">
            <label for="contribucion-lugar-texto" class="form-label">Lugar <span class="optional-note">(texto libre)</span></label>
            <input type="text" class="form-control" id="contribucion-lugar-texto" maxlength="160" placeholder="Ej.: Teatro de la Comedia, Paraninfo de la Universidad de...">
          </div>

          <p class="field-group-title mt-5 mb-2">Relaciones con otros objetos</p>
          <div class="mt-3">
            <label for="contribucion-linked-refs" class="form-label">Vínculos con objetos ya existentes en la <a href="/archivo/documentos">colección de documentos</a> <span class="optional-note">(opcional)</span></label>
            <textarea class="form-control" id="contribucion-linked-refs" rows="3" placeholder="Pega un enlace o un ID por línea"></textarea>
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
            <label for="contribucion-archivos-locales" class="form-label">Selecciona archivos (máx. 10 · 20 MB por archivo)</label>
            <input type="file" class="form-control" id="contribucion-archivos-locales" multiple accept=".pdf,image/jpeg,image/jpg,image/png,image/webp,image/tiff">
          </div>
          <div id="contribucion-recaptcha-wrap" class="mb-3">
            <p class="small mb-2">Validación anti-bot (reCAPTCHA)</p>
            <div id="contribucion-recaptcha-widget"></div>
          </div>
          <div class="participa-form-actions">
            <button type="button" id="btn-contribucion-subir" class="btn btn-dark">Subir archivos</button>
            <button type="button" id="btn-contribucion-cancelar-subida" class="btn btn-outline-dark">Cancelar subida</button>
          </div>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Archivos listos para envío</legend>
          <ul id="contribucion-archivos-subidos-lista" class="list-group mb-0"></ul>
        </fieldset>

        <fieldset class="participa-fieldset">
          <legend>Derechos sobre los archivos</legend>
          <small class="field-helper field-helper--intro">Estos derechos aplican a los archivos que subes.</small>
          <div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="contribucion-rights-type" id="contribucion-rights-cc" value="cc_by_nc_sa">
            <label class="form-check-label" for="contribucion-rights-cc">
              Licencia abierta <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank">CC-BY-NC-SA</a>
            </label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="contribucion-rights-type" id="contribucion-rights-copyright" value="copyright">
            <label class="form-check-label" for="contribucion-rights-copyright">
              Licencia cerrada: <a href="https://rightsstatements.org/page/InC-EDU/1.0/?language=es" target="_blank">Protegido por derechos de autor - uso educativo permitido</a>
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
              Declaro que puedo compartir estos archivos y acepto la <a href="{{ '/privacidad/' | relative_url }}" target="_blank" rel="noopener noreferrer">política de privacidad</a> para este envío.
              <span class="required-mark" aria-hidden="true">*</span>
            </label>
          </div>
        </fieldset>

        <div id="contribucion-step2-status" class="participa-form-status" aria-live="polite"></div>

        <div class="participa-form-actions mt-3">
          <button type="button" id="btn-contribucion-prev" class="btn btn-outline-dark">Volver</button>
          <button type="submit" id="btn-enviar-contribucion" class="btn btn-dark">Enviar contribución</button>
        </div>
      </section>
    </form>

    <section id="contribucion-success" class="participa-success card card-soft ui-thin-border p-3 p-md-4" hidden>
      <h2 class="h4 mb-2">¡Contribución enviada con éxito!</h2>
      <p class="mb-2">Hemos recibido tu aporte. Muchas gracias por participar en el proyecto.</p>
      <p class="mb-3">El ID de tu envío es <code id="contribucion-success-id"></code>. Puedes anotarlo por si más adelante quieres hacer alguna consulta.</p>
      <div id="contribucion-link-status" class="participa-form-status"></div>
      <div class="participa-form-actions">
        <a id="contribucion-cta-testimonio" href="{{ '/participa/testimonios/enviar/' | relative_url }}" class="btn btn-secondary-100">Añadir un testimonio vinculado</a>
        <a href="{{ '/participa/' | relative_url }}" class="btn btn-outline-dark">Volver a Participa</a>
      </div>
    </section>
  </div>
</section>
