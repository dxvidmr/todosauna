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
  var noFilesNotice = document.getElementById('contribucion-no-files-notice');
  var recaptchaWrap = document.getElementById('contribucion-recaptcha-wrap');
  var recaptchaLabel = recaptchaWrap ? recaptchaWrap.querySelector('p') : null;
  var recaptchaWidgetContainer = document.getElementById('contribucion-recaptcha-widget');
  var stagingIdInput = document.getElementById('contribucion-staging-id');

  var rightsFieldset = document.getElementById('contribucion-rights-fieldset');
  var rightsHolderWrap = document.getElementById('rights-holder-wrap');
  var rightsHolderInput = document.getElementById('contribucion-rights-holder');
  var creatorsList = document.getElementById('contribucion-creadores-list');
  var addCreatorButton = document.getElementById('btn-contribucion-add-creador');

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
  var cancelRequested = false;
  var isCancellingUpload = false;
  var isDeletingFile = false;
  var uploadAbortController = null;
  var currentStagingId = null;
  var stagedFiles = [];
  var creatorRowCount = creatorsList ? creatorsList.querySelectorAll('[data-creator-row]').length : 0;
  var pilotFormTracker = ns.pilotTracking && typeof ns.pilotTracking.bindFormTracking === 'function'
    ? ns.pilotTracking.bindFormTracking(form, { formName: 'documento' })
    : { markSubmitted: function () {} };

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

  function getCreatorRows() {
    if (!creatorsList) return [];
    return Array.prototype.slice.call(creatorsList.querySelectorAll('[data-creator-row]'));
  }

  function syncCreatorRows() {
    var rows = getCreatorRows();
    rows.forEach(function (row) {
      var removeButton = row.querySelector('[data-creator-remove]');
      if (removeButton) {
        removeButton.hidden = rows.length <= 1;
      }
    });
  }

  function createCreatorRow(nombre, rol) {
    creatorRowCount += 1;

    var row = document.createElement('div');
    row.className = 'creator-row';
    row.setAttribute('data-creator-row', '');

    var nameWrap = document.createElement('div');
    nameWrap.className = 'creator-row-field creator-row-field--name';
    var nameLabel = document.createElement('label');
    nameLabel.className = 'form-label mb-1';
    nameLabel.textContent = 'Nombre';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-control';
    nameInput.id = 'contribucion-creador-nombre-' + creatorRowCount;
    nameInput.setAttribute('data-creator-name', '');
    nameInput.setAttribute('maxlength', '160');
    nameInput.setAttribute('placeholder', 'Ej.: María Pérez');
    if (nombre) nameInput.value = nombre;
    nameLabel.setAttribute('for', nameInput.id);
    nameWrap.appendChild(nameLabel);
    nameWrap.appendChild(nameInput);

    var roleWrap = document.createElement('div');
    roleWrap.className = 'creator-row-field creator-row-field--role';
    var roleLabel = document.createElement('label');
    roleLabel.className = 'form-label mb-1';
    roleLabel.textContent = 'Rol';
    var roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.className = 'form-control';
    roleInput.id = 'contribucion-creador-rol-' + creatorRowCount;
    roleInput.setAttribute('data-creator-role', '');
    roleInput.setAttribute('maxlength', '160');
    roleInput.setAttribute('placeholder', 'Ej.: autora, fotógrafo, edición');
    if (rol) roleInput.value = rol;
    roleLabel.setAttribute('for', roleInput.id);
    roleWrap.appendChild(roleLabel);
    roleWrap.appendChild(roleInput);

    var removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn btn-outline-action btn-sm';
    removeButton.setAttribute('data-creator-remove', '');
    removeButton.textContent = 'Quitar';

    row.appendChild(nameWrap);
    row.appendChild(roleWrap);
    row.appendChild(removeButton);

    return row;
  }

  function addCreatorRow(nombre, rol) {
    if (!creatorsList) return;
    var row = createCreatorRow(nombre, rol);
    creatorsList.appendChild(row);
    syncCreatorRows();
    return row;
  }

  function collectCreatorsFromRows() {
    return getCreatorRows()
      .map(function (row) {
        var nameInput = row.querySelector('[data-creator-name]');
        var roleInput = row.querySelector('[data-creator-role]');
        var nombre = nullableText(nameInput ? nameInput.value : '');
        var rol = nullableText(roleInput ? roleInput.value : '');
        return { nombre: nombre, rol: rol };
      })
      .filter(function (row) {
        return !!row.nombre;
      });
  }

  function readCreators() {
    if (creatorsList) {
      return collectCreatorsFromRows();
    }

    var legacyField = document.getElementById('contribucion-creadores');
    return parseCreators(legacyField ? legacyField.value : '');
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
    var mode = String(cfg.recaptchaMode || 'auto').trim().toLowerCase();
    if (mode === 'v2' || mode === 'v3') return mode;
    return 'auto';
  }

  function hasRecaptchaSiteKey() {
    var cfg = getConfig();
    return !!String(cfg.recaptchaSiteKey || '').trim();
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

  function syncRightsFieldset() {
    if (rightsFieldset) rightsFieldset.hidden = !hasUploadReady();
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

  function createUploadAbortController() {
    if (typeof AbortController !== 'function') return null;
    try {
      return new AbortController();
    } catch (_err) {
      return null;
    }
  }

  function isUploadAbortedError(error) {
    if (!error) return false;
    if (error.code === 'upload_aborted') return true;
    return String(error.name || '') === 'AbortError';
  }

  function resetUploadLocalState(adapter) {
    if (adapter && typeof adapter.resetRecaptcha === 'function') {
      adapter.resetRecaptcha();
    }
    clearUploadedState();
    if (localFilesInput) localFilesInput.value = '';
  }

  async function cancelRemoteStaging(adapter, sessionId, stagingId) {
    if (!adapter || typeof adapter.cancelUpload !== 'function') return null;
    if (!sessionId || !stagingId) return null;

    try {
      var cancelResult = await adapter.cancelUpload({
        session_id: sessionId,
        staging_id: stagingId
      });
      if (cancelResult && cancelResult.error) return cancelResult.error;
    } catch (error) {
      return error;
    }

    return null;
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
      emptyItem.className = 'list-group-item text-quiet';
      emptyItem.textContent = 'Aún no hay archivos subidos.';
      uploadedFilesList.appendChild(emptyItem);
      if (noFilesNotice) noFilesNotice.hidden = false;
      return;
    }

    if (noFilesNotice) noFilesNotice.hidden = true;

    stagedFiles.forEach(function (file) {
      var item = document.createElement('li');
      item.className = 'list-group-item d-flex justify-content-between align-items-start gap-3';

      var main = document.createElement('div');
      var name = document.createElement('strong');
      name.textContent = file.name || 'Archivo sin nombre';
      var meta = document.createElement('div');
      meta.className = 'small text-quiet';
      meta.textContent = [file.mime || 'mime?', formatBytes(file.size)].join(' - ');
      main.appendChild(name);
      main.appendChild(meta);

      var badge = document.createElement('span');
      badge.className = 'badge badge-status-success';
      badge.textContent = 'Subido';

      var removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn btn-outline-action btn-sm';
      removeButton.setAttribute('data-uploaded-file-remove', file.drive_file_id || '');
      removeButton.textContent = isDeletingFile ? 'Eliminando...' : 'Eliminar';
      removeButton.disabled = isDeletingFile || isUploading || isSubmitting || isCancellingUpload;

      var actions = document.createElement('div');
      actions.className = 'd-flex align-items-center gap-2';
      actions.appendChild(badge);
      actions.appendChild(removeButton);

      item.appendChild(main);
      item.appendChild(actions);
      uploadedFilesList.appendChild(item);
    });

    syncRightsFieldset();
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

    var disablePrimary = isSubmitting || isDeletingFile;
    var disableFileActions = isDeletingFile || isUploading || isSubmitting || isCancellingUpload;
    if (nextButton) nextButton.disabled = disablePrimary;
    if (uploadButton) uploadButton.disabled = disablePrimary || isUploading;
    if (cancelUploadButton) cancelUploadButton.disabled = disablePrimary || isCancellingUpload;
    if (submitButton) submitButton.disabled = disablePrimary || isUploading || isCancellingUpload;
    if (uploadedFilesList) {
      var removeButtons = uploadedFilesList.querySelectorAll('[data-uploaded-file-remove]');
      Array.prototype.forEach.call(removeButtons, function (button) {
        button.disabled = disableFileActions;
        button.textContent = isDeletingFile ? 'Eliminando...' : 'Eliminar';
      });
    }
  }

  function handleParticipationStateChanged(event) {
    var detail = event && event.detail ? event.detail : null;

    if (detail && detail.sessionChanged) {
      var hadSessionBoundUpload = !!currentStagingId || stagedFiles.length > 0;
      var adapter = getUploadAdapter();

      if (adapter && typeof adapter.resetRecaptcha === 'function') {
        adapter.resetRecaptcha();
      }

      clearUploadedState();
      if (localFilesInput) localFilesInput.value = '';

      if (hadSessionBoundUpload) {
        setStatus(
          statusStep2,
          'La sesion ha cambiado. Debes volver a subir los archivos antes de enviar.',
          'info'
        );
      }
    }

    updateGateVisibility();
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

    if (titleInput && !titleInput.checkValidity()) {
      titleInput.reportValidity();
      return false;
    }

    if (!validateGeonamesSelection()) return false;

    return true;
  }

  function validateStepTwoRequirements() {
    var requiresRights = hasUploadReady();
    var rightsType = getRightsType();
    var consentInput = document.getElementById('contribucion-consent');

    if (requiresRights && !rightsType) {
      setStatus(statusStep2, 'Selecciona el tipo de derechos para continuar.', 'warning');
      return false;
    }

    if (requiresRights && rightsType === 'copyright' && !nullableText(rightsHolderInput ? rightsHolderInput.value : '')) {
      setStatus(statusStep2, 'Debes indicar el titular del copyright.', 'warning');
      if (rightsHolderInput && typeof rightsHolderInput.focus === 'function') {
        rightsHolderInput.focus();
      }
      return false;
    }

    if (consentInput && !consentInput.checkValidity()) {
      consentInput.reportValidity();
      return false;
    }

    return true;
  }

  function buildPayload() {
    var sessionId = getSessionId();
    var rightsType = getRightsType();
    var withFiles = hasUploadReady();
    var payloadRightsType = withFiles ? rightsType : null;

    return {
      session_id: sessionId,
      staging_id: withFiles ? currentStagingId : null,
      titulo: nullableText(document.getElementById('contribucion-titulo')?.value),
      descripcion: nullableText(document.getElementById('contribucion-descripcion')?.value),
      creadores: readCreators(),
      fecha: nullableText(document.getElementById('contribucion-fecha')?.value),
      fecha_texto: nullableText(document.getElementById('contribucion-fecha-texto')?.value),
      ciudad_nombre: nullableText(cityNameField ? cityNameField.value : ''),
      ciudad_geoname_id: nullableText(cityIdField ? cityIdField.value : ''),
      pais_nombre: nullableText(countryNameField ? countryNameField.value : ''),
      pais_geoname_id: nullableText(countryIdField ? countryIdField.value : ''),
      lugar_texto: nullableText(document.getElementById('contribucion-lugar-texto')?.value),
      linked_archive_refs: parseLines(document.getElementById('contribucion-linked-refs')?.value),
      rights_type: payloadRightsType,
      rights_holder: payloadRightsType === 'copyright' ? nullableText(rightsHolderInput ? rightsHolderInput.value : '') : null,
      drive_file_ids: withFiles ? null : [],
      privacy_consent: !!document.getElementById('contribucion-consent')?.checked,
      privacy_consent_version: CONSENT_VERSION,
      privacy_consent_at: new Date().toISOString()
    };
  }

  async function handleUploadClick() {
    if (isUploading || isCancellingUpload || isDeletingFile) return;

    setStatus(statusStep2, '', '');
    var files = localFilesInput && localFilesInput.files ? Array.from(localFilesInput.files) : [];
    if (!files.length) {
      setStatus(statusStep2, 'Selecciona al menos un archivo antes de subir.', 'warning');
      return;
    }

    var adapter = getUploadAdapter();
    if (!adapter || typeof adapter.uploadFiles !== 'function') {
      setStatus(statusStep2, 'El adaptador de subida no está disponible.', 'error');
      return;
    }

    var ensuredUpload = await ns.session.ensureSessionForWrite();
    if (!ensuredUpload || !ensuredUpload.ok) {
      setStatus(
        statusStep2,
        getErrorMessage(ensuredUpload && ensuredUpload.error, 'No se pudo preparar la sesión para subir archivos.', 'session_bootstrap'),
        'error'
      );
      return;
    }

    var sessionId = getSessionId();
    if (!sessionId) {
      setStatus(statusStep2, 'No hay sesión activa disponible. Recarga la página.', 'error');
      return;
    }

    cancelRequested = false;
    uploadAbortController = createUploadAbortController();
    isUploading = true;
    setUploadButtonLoading(true);
    updateGateVisibility();

    try {
      var result = await adapter.uploadFiles(files, {
        session_id: sessionId,
        staging_id: currentStagingId,
        recaptchaContainerId: 'contribucion-recaptcha-widget',
        signal: uploadAbortController ? uploadAbortController.signal : null,
        onStagingReady: function (stagingId) {
          setCurrentStagingId(stagingId);
        }
      });

      if (result.error || !result.data) {
        throw result.error || new Error('No se pudo completar la subida');
      }

      if (cancelRequested) {
        var remoteCancelAfterUpload = await cancelRemoteStaging(
          adapter,
          sessionId,
          result.data.staging_id || currentStagingId
        );
        resetUploadLocalState(adapter);

        if (remoteCancelAfterUpload) {
          setStatus(
            statusStep2,
            getErrorMessage(
              remoteCancelAfterUpload,
              'Subida cancelada localmente, pero no se pudo cancelar remoto.',
              'contribucion_cancel'
            ),
            'warning'
          );
        } else {
          setStatus(statusStep2, 'Subida cancelada y estado local limpiado.', 'info');
        }
        return;
      }

      setCurrentStagingId(result.data.staging_id || currentStagingId);
      stagedFiles = Array.isArray(result.data.files) ? result.data.files : [];
      renderUploadedFiles();

      if (localFilesInput) localFilesInput.value = '';
      setStatus(statusStep2, 'Archivos subidos y validados. Ya puedes enviar la contribución.', 'success');
    } catch (error) {
      if (cancelRequested || isUploadAbortedError(error)) {
        var remoteCancelError = await cancelRemoteStaging(adapter, sessionId, currentStagingId);
        resetUploadLocalState(adapter);

        if (remoteCancelError) {
          setStatus(
            statusStep2,
            getErrorMessage(
              remoteCancelError,
              'Subida cancelada localmente, pero no se pudo cancelar remoto.',
              'contribucion_cancel'
            ),
            'warning'
          );
        } else {
          setStatus(statusStep2, 'Subida cancelada y estado local limpiado.', 'info');
        }
      } else {
        var message = getErrorMessage(error, 'No se pudo completar la subida.', 'contribucion_upload');
        setStatus(statusStep2, message, 'error');
      }
    } finally {
      isUploading = false;
      isCancellingUpload = false;
      cancelRequested = false;
      uploadAbortController = null;
      setUploadButtonLoading(false);
      updateGateVisibility();
    }
  }

  async function handleCancelUpload() {
    if (isSubmitting || isCancellingUpload || isDeletingFile) return;
    setStatus(statusStep2, '', '');

    var adapter = getUploadAdapter();
    var sessionId = getSessionId();

    if (isUploading) {
      cancelRequested = true;
      isCancellingUpload = true;
      setStatus(statusStep2, 'Cancelando subida...', 'info');
      updateGateVisibility();

      if (uploadAbortController && typeof uploadAbortController.abort === 'function') {
        uploadAbortController.abort();
      }
      return;
    }

    isCancellingUpload = true;
    updateGateVisibility();

    try {
      var cancelError = await cancelRemoteStaging(adapter, sessionId, currentStagingId);
      resetUploadLocalState(adapter);

      if (cancelError) {
        setStatus(
          statusStep2,
          getErrorMessage(cancelError, 'Subida cancelada localmente, pero no se pudo cancelar remoto.', 'contribucion_cancel'),
          'warning'
        );
      } else {
        setStatus(statusStep2, 'Subida cancelada y estado local limpiado.', 'info');
      }
    } finally {
      isCancellingUpload = false;
      cancelRequested = false;
      uploadAbortController = null;
      updateGateVisibility();
    }
  }

  async function handleDeleteUploadedFile(driveFileId) {
    var targetId = nullableText(driveFileId);
    if (!targetId) return;
    if (isSubmitting || isUploading || isCancellingUpload || isDeletingFile) return;

    var adapter = getUploadAdapter();
    var sessionId = getSessionId();
    if (!adapter || typeof adapter.cancelUpload !== 'function') {
      setStatus(statusStep2, 'La operacion de borrado no esta disponible.', 'error');
      return;
    }
    if (!sessionId || !currentStagingId) {
      setStatus(statusStep2, 'No hay una subida activa para borrar archivos.', 'warning');
      return;
    }

    setStatus(statusStep2, 'Eliminando archivo subido...', 'info');
    isDeletingFile = true;
    updateGateVisibility();
    renderUploadedFiles();

    try {
      var response = await adapter.cancelUpload({
        session_id: sessionId,
        staging_id: currentStagingId,
        file_ids: [targetId]
      });

      if (response.error || !response.data) {
        throw response.error || new Error('No se pudo eliminar el archivo');
      }

      if (response.data.staging_id) {
        setCurrentStagingId(response.data.staging_id);
      }
      stagedFiles = Array.isArray(response.data.files) ? response.data.files : [];
      renderUploadedFiles();

      if (stagedFiles.length > 0) {
        setStatus(statusStep2, 'Archivo eliminado. Los demas archivos siguen listos para enviar.', 'success');
      } else {
        setStatus(statusStep2, 'Archivo eliminado. Puedes subir nuevos archivos o enviar solo datos.', 'info');
      }
    } catch (error) {
      setStatus(
        statusStep2,
        getErrorMessage(error, 'No se pudo eliminar el archivo seleccionado.', 'contribucion_delete_file'),
        'error'
      );
    } finally {
      isDeletingFile = false;
      updateGateVisibility();
      renderUploadedFiles();
    }
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
    if (isSubmitting || isDeletingFile) return;

    setStatus(statusStep1, '', '');
    setStatus(statusStep2, '', '');
    setStatus(linkStatus, '', '');

    if (!validateStepOne()) {
      setStep(1);
      return;
    }

    if (!validateStepTwoRequirements()) {
      setStep(2);
      return;
    }

    var modeReady = await ensureModeDefined(true);
    if (!modeReady) {
      setStatus(statusStep2, 'Debes definir modo de participación para enviar la contribución.', 'warning');
      setStep(2);
      return;
    }

    var ensuredSubmit = await ns.session.ensureSessionForWrite();
    if (!ensuredSubmit || !ensuredSubmit.ok) {
      setStatus(
        statusStep2,
        getErrorMessage(ensuredSubmit && ensuredSubmit.error, 'No se pudo preparar la sesión para enviar la contribución.', 'session_bootstrap'),
        'error'
      );
      setStep(2);
      return;
    }

    var payload = buildPayload();
    var hasFiles = hasUploadReady();
    if (!payload.session_id) {
      setStatus(statusStep2, 'No hay sesión activa. Recarga la página e inténtalo de nuevo.', 'error');
      setStep(2);
      return;
    }

    if (hasFiles && !payload.staging_id) {
      setStatus(statusStep2, 'No hay staging activo para el envío.', 'error');
      setStep(2);
      return;
    }

    if (!hasFiles) {
      var confirmed = window.confirm('¿Confirmas envío solo con datos y sin archivos?');
      if (!confirmed) {
        setStatus(statusStep2, 'Envio cancelado. Puedes revisar los datos antes de enviar.', 'info');
        setStep(2);
        return;
      }
    }

    isSubmitting = true;
    updateGateVisibility();
    if (submitButton) submitButton.textContent = 'Enviando...';

    try {
      var response = hasFiles
        ? await ns.apiV2.submitContribucionStaged(payload)
        : await ns.apiV2.submitContribucion(payload);
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
      pilotFormTracker.markSubmitted({
        upload_mode: hasFiles ? 'staged_files' : 'data_only',
        linked_testimonio_present: !!nullableText(hiddenLinkedTestimonioId ? hiddenLinkedTestimonioId.value : '')
      });
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

    if (uploadedFilesList) {
      uploadedFilesList.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var removeButton = target.closest('[data-uploaded-file-remove]');
        if (!removeButton) return;
        var driveFileId = removeButton.getAttribute('data-uploaded-file-remove');
        void handleDeleteUploadedFile(driveFileId);
      });
    }

    if (addCreatorButton) {
      addCreatorButton.addEventListener('click', function () {
        var newRow = addCreatorRow('', '');
        var nameInput = newRow ? newRow.querySelector('[data-creator-name]') : null;
        if (nameInput && typeof nameInput.focus === 'function') {
          nameInput.focus();
        }
      });
    }

    if (creatorsList) {
      creatorsList.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var removeButton = target.closest('[data-creator-remove]');
        if (!removeButton) return;

        var rows = getCreatorRows();
        if (rows.length <= 1) return;

        var row = removeButton.closest('[data-creator-row]');
        if (!row) return;
        row.remove();
        syncCreatorRows();
      });
    }

    var rightsRadios = document.querySelectorAll('input[name="contribucion-rights-type"]');
    rightsRadios.forEach(function (radio) {
      radio.addEventListener('change', syncRightsHolder);
    });

    window.addEventListener('participacion:state-changed', handleParticipationStateChanged);
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
    syncCreatorRows();
    syncRightsHolder();
    updateRecaptchaVisibility();
    setCurrentStagingId(stagingIdInput ? stagingIdInput.value : null);
    renderUploadedFiles();
    setStep(1);

    await ensureModeDefined(false);
    updateGateVisibility();
  }

  void init();
})();
