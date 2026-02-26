// ============================================
// PARTICIPACION: FORMULARIO TESTIMONIO
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  var form = document.getElementById('testimonio-form');
  if (!form) return;

  var CONSENT_VERSION = 'testimonio-envio-v1';
  var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  var statusBox = document.getElementById('testimonio-form-status');
  var successPanel = document.getElementById('testimonio-success');
  var successId = document.getElementById('testimonio-success-id');
  var linkStatus = document.getElementById('testimonio-link-status');
  var gate = document.getElementById('participa-mode-gate-testimonio');
  var gateBtn = document.getElementById('btn-definir-modo-testimonio');
  var submitButton = document.getElementById('btn-enviar-testimonio');

  var hiddenLinkedContribucionId = document.getElementById('testimonio-linked-contribucion-id');
  var ctaDocumento = document.getElementById('testimonio-cta-documento');

  var cityInput = document.getElementById('testimonio-experiencia-ciudad');
  var cityNameField = document.getElementById('testimonio-experiencia-ciudad-nombre');
  var cityIdField = document.getElementById('testimonio-experiencia-ciudad-id');
  var countryInput = document.getElementById('testimonio-experiencia-pais');
  var countryNameField = document.getElementById('testimonio-experiencia-pais-nombre');
  var countryIdField = document.getElementById('testimonio-experiencia-pais-id');

  var geoStatusField = document.createElement('p');
  geoStatusField.hidden = true;
  geoStatusField.className = 'participa-inline-status';
  if (cityInput && cityInput.parentElement) {
    cityInput.parentElement.insertAdjacentElement('afterend', geoStatusField);
  }

  var geoController = null;
  var isSubmitting = false;

  function setStatus(element, message, type) {
    if (!element) return;
    element.textContent = message || '';
    element.className = 'participa-form-status' + (type ? ' is-' + type : '');
    element.hidden = !message;
  }

  function setInlineStatus(message, type) {
    if (!geoStatusField) return;
    geoStatusField.textContent = message || '';
    geoStatusField.className = 'participa-inline-status' + (type ? ' is-' + type : '');
    geoStatusField.hidden = !message;
  }

  function parseLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function nullableText(value) {
    var trimmed = String(value || '').trim();
    return trimmed ? trimmed : null;
  }

  function getUserMessage(error, context, fallback) {
    if (ns.errors && typeof ns.errors.toUserMessage === 'function') {
      return ns.errors.toUserMessage(error, context, fallback);
    }
    if (error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    return fallback;
  }

  function isUuid(value) {
    return UUID_REGEX.test(String(value || '').trim());
  }

  function readLinkedContribucionIdFromUrl() {
    var params = new URLSearchParams(window.location.search || '');
    var value = (params.get('contribucion_id') || '').trim();
    return isUuid(value) ? value.toLowerCase() : null;
  }

  function updateGateVisibility() {
    var modeDefined = !!(ns.session && ns.session.isModeDefined && ns.session.isModeDefined());
    if (gate) gate.hidden = modeDefined;
    if (submitButton) submitButton.disabled = !modeDefined || isSubmitting;
  }

  async function ensureModeDefined(openIfMissing) {
    if (!ns.session || !ns.apiV2) {
      setStatus(statusBox, 'La capa de participación no está disponible.', 'error');
      return false;
    }

    await ns.session.init();

    if (ns.session.isModeDefined && ns.session.isModeDefined()) {
      updateGateVisibility();
      return true;
    }

    if (openIfMissing && ns.modal && typeof ns.modal.open === 'function') {
      await ns.modal.open({
        context: 'participa-form-access',
        reason: 'testimonio-form'
      });
    }

    updateGateVisibility();
    return !!(ns.session.isModeDefined && ns.session.isModeDefined());
  }

  function readPrivacySettings() {
    return {
      mostrar_nombre: !!document.getElementById('privacy-mostrar-nombre')?.checked,
      mostrar_ciudad: !!document.getElementById('privacy-mostrar-ciudad')?.checked,
      mostrar_pais: !!document.getElementById('privacy-mostrar-pais')?.checked,
      mostrar_fecha: !!document.getElementById('privacy-mostrar-fecha')?.checked,
      mostrar_rango_edad: !!document.getElementById('privacy-mostrar-rango-edad')?.checked,
      mostrar_contexto: !!document.getElementById('privacy-mostrar-contexto')?.checked,
      mostrar_lugar_texto: !!document.getElementById('privacy-mostrar-lugar-texto')?.checked
    };
  }

  function validateGeonamesSelection() {
    var typedCity = nullableText(cityInput ? cityInput.value : '');
    var selectedCityId = nullableText(cityIdField ? cityIdField.value : '');
    var selectedCountryId = nullableText(countryIdField ? countryIdField.value : '');

    if (!typedCity) {
      setInlineStatus('', '');
      return true;
    }

    if (!selectedCityId || !selectedCountryId) {
      setInlineStatus('Selecciona una ciudad de la lista de GeoNames o borra el campo.', 'error');
      return false;
    }

    setInlineStatus('', '');
    return true;
  }

  function buildPayload() {
    var state = ns.session.getState();

    return {
      session_id: state.sessionId,
      titulo: nullableText(document.getElementById('testimonio-titulo')?.value),
      testimonio: nullableText(document.getElementById('testimonio-texto')?.value),
      experiencia_fecha: nullableText(document.getElementById('testimonio-fecha')?.value),
      experiencia_fecha_texto: nullableText(document.getElementById('testimonio-fecha-texto')?.value),
      experiencia_ciudad_nombre: nullableText(cityNameField ? cityNameField.value : ''),
      experiencia_ciudad_geoname_id: nullableText(cityIdField ? cityIdField.value : ''),
      experiencia_pais_nombre: nullableText(countryNameField ? countryNameField.value : ''),
      experiencia_pais_geoname_id: nullableText(countryIdField ? countryIdField.value : ''),
      experiencia_lugar_texto: nullableText(document.getElementById('testimonio-lugar-texto')?.value),
      experiencia_contexto: nullableText(document.getElementById('testimonio-contexto')?.value),
      experiencia_rango_edad: nullableText(document.getElementById('testimonio-rango-edad')?.value),
      linked_archive_refs: parseLines(document.getElementById('testimonio-linked-refs')?.value),
      privacy_settings: readPrivacySettings(),
      privacy_consent: !!document.getElementById('testimonio-consent')?.checked,
      privacy_consent_version: CONSENT_VERSION,
      privacy_consent_at: new Date().toISOString()
    };
  }

  async function maybeLinkContribucion(testimonioId) {
    var contribucionId = nullableText(hiddenLinkedContribucionId ? hiddenLinkedContribucionId.value : '');
    if (!contribucionId || !isUuid(contribucionId)) {
      setStatus(linkStatus, '', '');
      return;
    }

    var state = ns.session.getState();
    var response = await ns.apiV2.linkTestimonioContribucion({
      session_id: state.sessionId,
      testimonio_id: testimonioId,
      contribucion_id: contribucionId,
      declared_from: 'testimonio_form'
    });

    if (response.error || !response.data || !response.data.vinculo_id) {
      setStatus(linkStatus, 'El testimonio se guardó, pero no se pudo crear el vínculo automático con el documento.', 'warning');
      return;
    }

    setStatus(linkStatus, 'El testimonio quedó vinculado al documento indicado.', 'success');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setStatus(statusBox, '', '');
    setStatus(linkStatus, '', '');

    if (!form.reportValidity()) return;
    if (!validateGeonamesSelection()) return;

    var modeReady = await ensureModeDefined(true);
    if (!modeReady) {
      setStatus(statusBox, 'Debes definir modo de participación para enviar el testimonio.', 'warning');
      return;
    }

    var payload = buildPayload();

    if (!payload.session_id) {
      setStatus(statusBox, 'No hay sesión activa disponible. Recarga la página e inténtalo de nuevo.', 'error');
      return;
    }

    isSubmitting = true;
    updateGateVisibility();
    if (submitButton) submitButton.textContent = 'Enviando...';

    try {
      var response = await ns.apiV2.submitTestimonio(payload);

      if (response.error || !response.data || !response.data.testimonio_id) {
        throw response.error || new Error('No se pudo guardar el testimonio');
      }

      var testimonioId = response.data.testimonio_id;
      if (successId) successId.textContent = testimonioId;

      if (ctaDocumento) {
        var target = new URL(ctaDocumento.getAttribute('href') || '/participa/documentos/enviar/', window.location.origin);
        target.searchParams.set('testimonio_id', testimonioId);
        ctaDocumento.setAttribute('href', target.pathname + target.search);
      }

      await maybeLinkContribucion(testimonioId);

      form.hidden = true;
      if (gate) gate.hidden = true;
      if (successPanel) successPanel.hidden = false;
    } catch (error) {
      var errorMessage = getUserMessage(error, 'testimonio_submit', 'No se pudo enviar el testimonio.');
      setStatus(statusBox, errorMessage, 'error');
    } finally {
      isSubmitting = false;
      if (submitButton) submitButton.textContent = 'Enviar testimonio';
      updateGateVisibility();
    }
  }

  async function init() {
    if (!ns.session || !ns.apiV2) {
      setStatus(statusBox, 'No se pudo inicializar la capa de participación.', 'error');
      return;
    }

    var contribucionId = readLinkedContribucionIdFromUrl();
    if (hiddenLinkedContribucionId && contribucionId) {
      hiddenLinkedContribucionId.value = contribucionId;
      setStatus(statusBox, 'Este testimonio se vinculará automáticamente con el documento indicado al enviar.', 'info');
    }

    if (ns.geo && typeof ns.geo.attachCityAutocomplete === 'function') {
      geoController = ns.geo.attachCityAutocomplete({
        input: cityInput,
        cityNameField: cityNameField,
        cityIdField: cityIdField,
        countryNameField: countryNameField,
        countryIdField: countryIdField,
        countryDisplayField: countryInput,
        clearButton: '#testimonio-limpiar-ciudad',
        statusField: geoStatusField
      });
      if (!geoController) {
        setInlineStatus('No se pudo inicializar GeoNames en este formulario.', 'warning');
      }
    }

    form.addEventListener('submit', handleSubmit);

    if (gateBtn) {
      gateBtn.addEventListener('click', async function () {
        await ensureModeDefined(true);
      });
    }

    await ensureModeDefined(true);
  }

  void init();
})();
