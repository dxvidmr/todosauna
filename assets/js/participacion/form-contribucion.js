// ============================================
// PARTICIPACION: FORMULARIO CONTRIBUCION ARCHIVO
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  var form = document.getElementById('contribucion-form');
  if (!form) return;

  var CONSENT_VERSION = 'contribucion-envio-v1';
  var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  var step1 = document.getElementById('contribucion-step-1');
  var step2 = document.getElementById('contribucion-step-2');
  var stepIndicators = Array.prototype.slice.call(document.querySelectorAll('.participa-step'));

  var statusStep1 = document.getElementById('contribucion-step1-status');
  var statusStep2 = document.getElementById('contribucion-step2-status');
  var successPanel = document.getElementById('contribucion-success');
  var successId = document.getElementById('contribucion-success-id');
  var linkStatus = document.getElementById('contribucion-link-status');
  var ctaTestimonio = document.getElementById('contribucion-cta-testimonio');

  var gate = document.getElementById('participa-mode-gate-documento');
  var gateBtn = document.getElementById('btn-definir-modo-documento');

  var nextButton = document.getElementById('btn-contribucion-next');
  var prevButton = document.getElementById('btn-contribucion-prev');
  var submitButton = document.getElementById('btn-enviar-contribucion');

  var uploadButton = document.getElementById('btn-contribucion-subir');
  var cancelUploadButton = document.getElementById('btn-contribucion-cancelar-subida');
  var uploadButtonDefaultHtml = uploadButton ? uploadButton.innerHTML : 'Subir archivos';
  var localFilesInput = document.getElementById('contribucion-archivos-locales');
  var uploadedFilesList = document.getElementById('contribucion-archivos-subidos-lista');
  var recaptchaWrap = document.getElementById('contribucion-recaptcha-wrap');
  var recaptchaLabel = recaptchaWrap ? recaptchaWrap.querySelector('p') : null;
  var recaptchaWidgetContainer = document.getElementById('contribucion-recaptcha-widget');
  var stagingIdInput = document.getElementById('contribucion-staging-id');

  var rightsHolderWrap = document.getElementById('rights-holder-wrap');
  var rightsHolderInput = document.getElementById('contribucion-rights-holder');

  var hiddenLinkedTestimonioId = document.getElementById('contribucion-linked-testimonio-id');

  var cityInput = document.getElementById('contribucion-ciudad');
  var cityNameField = document.getElementById('contribucion-ciudad-nombre');
  var cityIdField = document.getElementById('contribucion-ciudad-id');
  var countryInput = document.getElementById('contribucion-pais');
  var countryNameField = document.getElementById('contribucion-pais-nombre');
  var countryIdField = document.getElementById('contribucion-pais-id');

  var geoStatusField = document.createElement('p');
  geoStatusField.hidden = true;
  geoStatusField.className = 'participa-inline-status';
  if (cityInput && cityInput.parentElement) {
    cityInput.parentElement.insertAdjacentElement('afterend', geoStatusField);
  }

  var currentStep = 1;
  var isSubmitting = false;
  var isUploading = false;
  var currentStagingId = null;
  var stagedFiles = [];

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

  function nullableText(value) {
    var trimmed = String(value || '').trim();
    return trimmed ? trimmed : null;
  }

  function parseLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function parseCreators(value) {
    return parseLines(value)
      .map(function (line) {
        var parts = line.split('|');
        var nombre = nullableText(parts[0] || '');
        var rol = nullableText(parts.slice(1).join('|'));
        return { nombre: nombre, rol: rol };
      })
      .filter(function (row) {
        return !!row.nombre;
      });
  }

  function isUuid(value) {
    return UUID_REGEX.test(String(value || '').trim());
  }

  function getLinkedTestimonioFromUrl() {
    var params = new URLSearchParams(window.location.search || '');
    var value = (params.get('testimonio_id') || '').trim();
    return isUuid(value) ? value.toLowerCase() : null;
  }

  function getRightsType() {
    var selected = document.querySelector('input[name="contribucion-rights-type"]:checked');
    return selected ? selected.value : null;
  }

  function getUploadAdapter() {
    return ns.upload || null;
  }

  function getSessionId() {
    if (!ns.session || typeof ns.session.getState !== 'function') return null;
    var state = ns.session.getState();
    return state && state.sessionId ? state.sessionId : null;
  }

  function getConfig() {
    return ns.config || {};
  }

  function getRecaptchaMode() {
    var cfg = getConfig();
    var mode = String(cfg.recaptchaMode || window.RECAPTCHA_MODE || 'auto').trim().toLowerCase();
    if (mode === 'v2' || mode === 'v3') return mode;
    return 'auto';
  }

  function hasRecaptchaSiteKey() {
    var cfg = getConfig();
    return !!String(cfg.recaptchaSiteKey || window.RECAPTCHA_SITE_KEY || '').trim();
  }

  function getErrorMessage(error, fallback, context) {
    if (ns.errors && typeof ns.errors.toUserMessage === 'function') {
      return ns.errors.toUserMessage(error, context || 'contribucion_submit', fallback || 'Error inesperado');
    }

    if (!error) return fallback || 'Error inesperado';
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    if (error.error && typeof error.error === 'string' && error.error.trim()) return error.error.trim();
    if (error.error && typeof error.error.message === 'string' && error.error.message.trim()) return error.error.message.trim();
    if (error.details && typeof error.details === 'string' && error.details.trim()) return error.details.trim();
    return fallback || 'Error inesperado';
  }

  function syncRightsHolder() {
    var rightsType = getRightsType();
    var needsHolder = rightsType === 'copyright';

    if (rightsHolderWrap) rightsHolderWrap.hidden = !needsHolder;
    if (rightsHolderInput) {
      rightsHolderInput.required = needsHolder;
      if (!needsHolder) rightsHolderInput.value = '';
    }
  }

  function setStep(stepNumber) {
    currentStep = stepNumber;
    if (step1) step1.hidden = stepNumber !== 1;
    if (step2) step2.hidden = stepNumber !== 2;

    stepIndicators.forEach(function (stepLabel) {
      var stepValue = Number(stepLabel.getAttribute('data-step') || '0');
      stepLabel.classList.toggle('is-active', stepValue === stepNumber);
    });
  }

  function setCurrentStagingId(stagingId) {
    currentStagingId = nullableText(stagingId);
    if (stagingIdInput) {
      stagingIdInput.value = currentStagingId || '';
    }
  }

  function clearUploadedState() {
    setCurrentStagingId(null);
    stagedFiles = [];
    renderUploadedFiles();
  }

  function formatBytes(bytes) {
    var size = Number(bytes || 0);
    if (!Number.isFinite(size) || size < 1) return '0 B';
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderUploadedFiles() {
    if (!uploadedFilesList) return;
    uploadedFilesList.innerHTML = '';

    if (!stagedFiles.length) {
      var emptyItem = document.createElement('li');
      emptyItem.className = 'list-group-item text-muted';
      emptyItem.textContent = 'Aún no hay archivos subidos.';
      uploadedFilesList.appendChild(emptyItem);
      return;
    }

    stagedFiles.forEach(function (file) {
      var item = document.createElement('li');
      item.className = 'list-group-item d-flex justify-content-between align-items-start gap-3';

      var main = document.createElement('div');
      var name = document.createElement('strong');
      name.textContent = file.name || 'Archivo sin nombre';
      var meta = document.createElement('div');
      meta.className = 'small text-muted';
      meta.textContent = [file.mime || 'mime?', formatBytes(file.size)].join(' - ');
      main.appendChild(name);
      main.appendChild(meta);

      var badge = document.createElement('span');
      badge.className = 'badge text-bg-success';
      badge.textContent = 'Subido';

      item.appendChild(main);
      item.appendChild(badge);
      uploadedFilesList.appendChild(item);
    });
  }

  function updateRecaptchaVisibility() {
    if (!recaptchaWrap) return;
    var hasKey = hasRecaptchaSiteKey();
    var mode = getRecaptchaMode();
    var useV3 = mode === 'v3';

    // In v3 there is no visible widget; only show status/errors in statusStep2.
    recaptchaWrap.hidden = !hasKey || useV3;
    if (!hasKey || useV3) return;

    if (recaptchaLabel) {
      recaptchaLabel.textContent = 'Validacion anti-bot (reCAPTCHA)';
    }
    if (recaptchaWidgetContainer) {
      recaptchaWidgetContainer.hidden = false;
    }
  }

  function hasUploadReady() {
    return !!currentStagingId && Array.isArray(stagedFiles) && stagedFiles.length > 0;
  }

  function setUploadButtonLoading(isLoading) {
    if (!uploadButton) return;

    if (isLoading) {
      uploadButton.disabled = true;
      uploadButton.setAttribute('aria-busy', 'true');
      uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Subiendo archivos...';
      return;
    }

    uploadButton.removeAttribute('aria-busy');
    uploadButton.innerHTML = uploadButtonDefaultHtml;
    uploadButton.disabled = false;
  }

  function updateGateVisibility() {
    var modeDefined = !!(ns.session && ns.session.isModeDefined && ns.session.isModeDefined());
    if (gate) gate.hidden = modeDefined;

    var disablePrimary = !modeDefined || isSubmitting;
    if (nextButton) nextButton.disabled = disablePrimary;
    if (uploadButton) uploadButton.disabled = disablePrimary || isUploading;
    if (cancelUploadButton) cancelUploadButton.disabled = disablePrimary || isUploading;
    if (submitButton) submitButton.disabled = disablePrimary || isUploading || !hasUploadReady();
  }

  async function ensureModeDefined(openIfMissing) {
    if (!ns.session || !ns.apiV2) {
      setStatus(statusStep1, 'La capa de participación no está disponible.', 'error');
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
        reason: 'documento-form'
      });
    }

    updateGateVisibility();
    return !!(ns.session.isModeDefined && ns.session.isModeDefined());
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
      setInlineStatus('Selecciona una ciudad válida de GeoNames o borra el campo.', 'error');
      return false;
    }

    setInlineStatus('', '');
    return true;
  }

  function validateStepOne() {
    setStatus(statusStep1, '', '');

    var titleInput = document.getElementById('contribucion-titulo');
    var consentInput = document.getElementById('contribucion-consent');

    if (titleInput && !titleInput.checkValidity()) {
      titleInput.reportValidity();
      return false;
    }

    if (consentInput && !consentInput.checkValidity()) {
      consentInput.reportValidity();
      return false;
    }

    if (!validateGeonamesSelection()) return false;

    var rightsType = getRightsType();
    if (!rightsType) {
      setStatus(statusStep1, 'Selecciona el tipo de derechos para continuar.', 'warning');
      return false;
    }

    if (rightsType === 'copyright' && !nullableText(rightsHolderInput ? rightsHolderInput.value : '')) {
      setStatus(statusStep1, 'Debes indicar el titular del copyright.', 'warning');
      return false;
    }

    return true;
  }

  function buildPayload() {
    var sessionId = getSessionId();
    var rightsType = getRightsType();

    return {
      session_id: sessionId,
      staging_id: currentStagingId,
      titulo: nullableText(document.getElementById('contribucion-titulo')?.value),
      descripcion: nullableText(document.getElementById('contribucion-descripcion')?.value),
      creadores: parseCreators(document.getElementById('contribucion-creadores')?.value),
      fecha: nullableText(document.getElementById('contribucion-fecha')?.value),
      fecha_texto: nullableText(document.getElementById('contribucion-fecha-texto')?.value),
      ciudad_nombre: nullableText(cityNameField ? cityNameField.value : ''),
      ciudad_geoname_id: nullableText(cityIdField ? cityIdField.value : ''),
      pais_nombre: nullableText(countryNameField ? countryNameField.value : ''),
      pais_geoname_id: nullableText(countryIdField ? countryIdField.value : ''),
      lugar_texto: nullableText(document.getElementById('contribucion-lugar-texto')?.value),
      linked_archive_refs: parseLines(document.getElementById('contribucion-linked-refs')?.value),
      rights_type: rightsType,
      rights_holder: rightsType === 'copyright' ? nullableText(rightsHolderInput ? rightsHolderInput.value : '') : null,
      privacy_consent: !!document.getElementById('contribucion-consent')?.checked,
      privacy_consent_version: CONSENT_VERSION,
      privacy_consent_at: new Date().toISOString()
    };
  }

  async function handleUploadClick() {
    if (isUploading) return;

    setStatus(statusStep2, '', '');
    var files = localFilesInput && localFilesInput.files ? Array.from(localFilesInput.files) : [];
    if (!files.length) {
      setStatus(statusStep2, 'Selecciona al menos un archivo antes de subir.', 'warning');
      return;
    }

    var modeReady = await ensureModeDefined(true);
    if (!modeReady) {
      setStatus(statusStep2, 'Debes definir modo de participación antes de subir.', 'warning');
      return;
    }

    var adapter = getUploadAdapter();
    if (!adapter || typeof adapter.uploadFiles !== 'function') {
      setStatus(statusStep2, 'El adaptador de subida no está disponible.', 'error');
      return;
    }

    var sessionId = getSessionId();
    if (!sessionId) {
      setStatus(statusStep2, 'No hay sesión activa disponible. Recarga la página.', 'error');
      return;
    }

    isUploading = true;
    setUploadButtonLoading(true);
    updateGateVisibility();

    try {
      var result = await adapter.uploadFiles(files, {
        session_id: sessionId,
        staging_id: currentStagingId,
        recaptchaContainerId: 'contribucion-recaptcha-widget'
      });

      if (result.error || !result.data) {
        throw result.error || new Error('No se pudo completar la subida');
      }

      setCurrentStagingId(result.data.staging_id || currentStagingId);
      stagedFiles = Array.isArray(result.data.files) ? result.data.files : [];
      renderUploadedFiles();

      if (localFilesInput) localFilesInput.value = '';
      setStatus(statusStep2, 'Archivos subidos y validados. Ya puedes enviar la contribución.', 'success');
    } catch (error) {
      var message = getErrorMessage(error, 'No se pudo completar la subida.', 'contribucion_upload');
      setStatus(statusStep2, message, 'error');
    } finally {
      isUploading = false;
      setUploadButtonLoading(false);
      updateGateVisibility();
    }
  }

  async function handleCancelUpload() {
    setStatus(statusStep2, '', '');

    var adapter = getUploadAdapter();
    var sessionId = getSessionId();

    if (adapter && typeof adapter.cancelUpload === 'function' && currentStagingId && sessionId) {
      var cancelResult = await adapter.cancelUpload({
        session_id: sessionId,
        staging_id: currentStagingId
      });
      if (cancelResult && cancelResult.error) {
        setStatus(statusStep2, getErrorMessage(cancelResult.error, 'No se pudo cancelar remoto.', 'contribucion_cancel'), 'warning');
      }
    }

    if (adapter && typeof adapter.resetRecaptcha === 'function') {
      adapter.resetRecaptcha();
    }

    clearUploadedState();
    if (localFilesInput) localFilesInput.value = '';
    setStatus(statusStep2, 'Subida cancelada y estado local limpiado.', 'info');
    updateGateVisibility();
  }

  async function maybeLinkTestimonio(contribucionId) {
    var testimonioId = nullableText(hiddenLinkedTestimonioId ? hiddenLinkedTestimonioId.value : '');
    if (!testimonioId || !isUuid(testimonioId)) {
      setStatus(linkStatus, '', '');
      return;
    }

    var sessionId = getSessionId();
    if (!sessionId) return;

    var response = await ns.apiV2.linkTestimonioContribucion({
      session_id: sessionId,
      testimonio_id: testimonioId,
      contribucion_id: contribucionId,
      declared_from: 'documento_form'
    });

    if (response.error || !response.data || !response.data.vinculo_id) {
      setStatus(linkStatus, 'La contribución se guardó, pero no se pudo crear el vínculo con el testimonio.', 'warning');
      return;
    }

    setStatus(linkStatus, 'La contribución quedó vinculada al testimonio indicado.', 'success');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setStatus(statusStep1, '', '');
    setStatus(statusStep2, '', '');
    setStatus(linkStatus, '', '');

    if (!validateStepOne()) {
      setStep(1);
      return;
    }

    if (!hasUploadReady()) {
      setStatus(statusStep2, 'Primero sube y valida al menos un archivo.', 'warning');
      setStep(2);
      updateGateVisibility();
      return;
    }

    var modeReady = await ensureModeDefined(true);
    if (!modeReady) {
      setStatus(statusStep1, 'Debes definir modo de participación para enviar la contribución.', 'warning');
      setStep(1);
      return;
    }

    var payload = buildPayload();
    if (!payload.session_id) {
      setStatus(statusStep1, 'No hay sesión activa. Recarga la página e inténtalo de nuevo.', 'error');
      setStep(1);
      return;
    }

    if (!payload.staging_id) {
      setStatus(statusStep2, 'No hay staging activo para el envío.', 'error');
      setStep(2);
      return;
    }

    isSubmitting = true;
    updateGateVisibility();
    if (submitButton) submitButton.textContent = 'Enviando...';

    try {
      var response = await ns.apiV2.submitContribucionStaged(payload);
      if (response.error || !response.data || !response.data.contribucion_id) {
        throw response.error || new Error('No se pudo guardar la contribución');
      }

      var contribucionId = response.data.contribucion_id;
      if (successId) successId.textContent = contribucionId;

      if (ctaTestimonio) {
        var target = new URL(ctaTestimonio.getAttribute('href') || '/participa/testimonios/enviar/', window.location.origin);
        target.searchParams.set('contribucion_id', contribucionId);
        ctaTestimonio.setAttribute('href', target.pathname + target.search);
      }

      await maybeLinkTestimonio(contribucionId);
      form.hidden = true;
      if (gate) gate.hidden = true;
      if (successPanel) successPanel.hidden = false;
    } catch (error) {
      var errorMessage = getErrorMessage(error, 'No se pudo enviar la contribución.', 'contribucion_submit');
      setStatus(statusStep2, errorMessage, 'error');
      setStep(2);
    } finally {
      isSubmitting = false;
      if (submitButton) submitButton.textContent = 'Enviar contribución';
      updateGateVisibility();
    }
  }

  function bindEvents() {
    form.addEventListener('submit', handleSubmit);

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        if (!validateStepOne()) return;
        setStatus(statusStep1, '', '');
        setStep(2);
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', function () {
        setStatus(statusStep2, '', '');
        setStep(1);
      });
    }

    if (gateBtn) {
      gateBtn.addEventListener('click', async function () {
        await ensureModeDefined(true);
      });
    }

    if (uploadButton) {
      uploadButton.addEventListener('click', function () {
        void handleUploadClick();
      });
    }

    if (cancelUploadButton) {
      cancelUploadButton.addEventListener('click', function () {
        void handleCancelUpload();
      });
    }

    var rightsRadios = document.querySelectorAll('input[name="contribucion-rights-type"]');
    rightsRadios.forEach(function (radio) {
      radio.addEventListener('change', syncRightsHolder);
    });

    window.addEventListener('participacion:state-changed', updateGateVisibility);
  }

  async function init() {
    if (!ns.session || !ns.apiV2) {
      setStatus(statusStep1, 'No se pudo inicializar la capa de participación.', 'error');
      return;
    }

    var testimonioId = getLinkedTestimonioFromUrl();
    if (hiddenLinkedTestimonioId && testimonioId) {
      hiddenLinkedTestimonioId.value = testimonioId;
      setStatus(statusStep1, 'Esta contribución se vinculará automáticamente con el testimonio indicado.', 'info');
    }

    if (ns.geo && typeof ns.geo.attachCityAutocomplete === 'function') {
      ns.geo.attachCityAutocomplete({
        input: cityInput,
        cityNameField: cityNameField,
        cityIdField: cityIdField,
        countryNameField: countryNameField,
        countryIdField: countryIdField,
        countryDisplayField: countryInput,
        clearButton: '#contribucion-limpiar-ciudad',
        statusField: geoStatusField
      });
    }

    bindEvents();
    syncRightsHolder();
    updateRecaptchaVisibility();
    setCurrentStagingId(stagingIdInput ? stagingIdInput.value : null);
    renderUploadedFiles();
    setStep(1);

    await ensureModeDefined(true);
    updateGateVisibility();
  }

  void init();
})();
