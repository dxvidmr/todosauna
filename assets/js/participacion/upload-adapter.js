// ============================================
// PARTICIPACION: UPLOAD ADAPTER (DRIVE STAGING)
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.upload) return;

  var DEFAULT_RECAPTCHA_CONTAINER_ID = 'contribucion-recaptcha-widget';
  var recaptchaWidgetId = null;
  var recaptchaRenderPromise = null;
  var recaptchaMode = 'auto'; // auto -> try v2 checkbox, fallback to v3 execute

  function getConfig() {
    return ns.config || {};
  }

  function getSupabaseUrl() {
    var url = String(getConfig().url || '').trim();
    return url.replace(/\/+$/g, '');
  }

  function getSupabaseAnonKey() {
    var config = getConfig();
    return String(config.publishableKey || config.anonKey || '').trim();
  }

  function getAppsScriptUrl() {
    var config = getConfig();
    return String(
      config.appsScriptUrl ||
      (window.__SUPABASE_CONFIG__ && window.__SUPABASE_CONFIG__.appsScriptUrl) ||
      window.APPS_SCRIPT_URL ||
      ''
    ).trim();
  }

  function getRecaptchaSiteKey() {
    var config = getConfig();
    return String(
      config.recaptchaSiteKey ||
      (window.__SUPABASE_CONFIG__ && window.__SUPABASE_CONFIG__.recaptchaSiteKey) ||
      window.RECAPTCHA_SITE_KEY ||
      ''
    ).trim();
  }

  function getConfiguredRecaptchaMode() {
    var config = getConfig();
    var mode = String(
      config.recaptchaMode ||
      (window.__SUPABASE_CONFIG__ && window.__SUPABASE_CONFIG__.recaptchaMode) ||
      window.RECAPTCHA_MODE ||
      'auto'
    ).trim().toLowerCase();

    if (mode === 'v2' || mode === 'v3') return mode;
    return 'auto';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  recaptchaMode = getConfiguredRecaptchaMode();

  function normalizeFileObject(file) {
    return {
      name: String(file && file.name ? file.name : '').trim(),
      mime: String(file && file.type ? file.type : '').trim().toLowerCase(),
      size: Number(file && file.size ? file.size : 0)
    };
  }

  function stringifyUnknown(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value.message === 'string' && value.message.trim()) return value.message.trim();
    if (value && value.error && typeof value.error === 'string' && value.error.trim()) return value.error.trim();
    if (value && value.error && typeof value.error.message === 'string' && value.error.message.trim()) {
      return value.error.message.trim();
    }
    if (value && typeof value.details === 'string' && value.details.trim()) return value.details.trim();
    try {
      var serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}' && serialized !== 'null') return serialized;
    } catch (_err) {
      // Ignore serialization errors and use fallback.
    }
    return fallback || 'Error no especificado';
  }

  function normalizeError(message) {
    return { message: stringifyUnknown(message, 'Error no especificado') };
  }

  function extractErrorMessage(errorLike, fallback) {
    return stringifyUnknown(errorLike, fallback || 'Error no especificado');
  }

  async function callEdgeFunction(functionName, payload) {
    var url = getSupabaseUrl();
    var anonKey = getSupabaseAnonKey();

    if (!url || !anonKey) {
      return { data: null, error: normalizeError('Supabase no esta configurado para edge functions') };
    }

    var endpoint = url + '/functions/v1/' + functionName;
    var response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: 'Bearer ' + anonKey
        },
        body: JSON.stringify(payload || {})
      });
    } catch (err) {
      return {
        data: null,
        error: normalizeError(err && err.message ? err.message : 'No se pudo conectar con edge function')
      };
    }

    var parsed = null;
    try {
      parsed = await response.json();
    } catch (_err) {
      parsed = null;
    }

    if (!response.ok) {
      var message = extractErrorMessage(parsed, 'Error en ' + functionName);
      return { data: null, error: normalizeError(message) };
    }

    if (parsed && parsed.ok === false) {
      return { data: null, error: normalizeError(extractErrorMessage(parsed, 'Error en ' + functionName)) };
    }

    return { data: parsed, error: null };
  }

  async function waitForRecaptchaApi(maxWaitMs, predicate) {
    var startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      if (window.grecaptcha && (!predicate || predicate(window.grecaptcha))) {
        return true;
      }
      await new Promise(function (resolve) { setTimeout(resolve, 120); });
    }
    return false;
  }

  function isInvalidKeyTypeError(error) {
    var message = String((error && error.message) || '').toLowerCase();
    return message.indexOf('invalid key type') >= 0 || message.indexOf('invalid site key') >= 0;
  }

  async function ensureRecaptchaWidget(containerId) {
    var siteKey = getRecaptchaSiteKey();
    if (!siteKey) return null;
    if (recaptchaMode === 'v3') return null;

    var container = document.getElementById(containerId || DEFAULT_RECAPTCHA_CONTAINER_ID);
    if (!container) {
      throw new Error('No se encontro el contenedor de reCAPTCHA');
    }

    if (recaptchaWidgetId !== null) return recaptchaWidgetId;
    if (recaptchaRenderPromise) return recaptchaRenderPromise;

    recaptchaRenderPromise = (async function () {
      var ready = await waitForRecaptchaApi(7000, function (grecaptcha) {
        return typeof grecaptcha.render === 'function';
      });
      if (!ready) {
        throw new Error('reCAPTCHA no esta disponible');
      }

      try {
        recaptchaWidgetId = window.grecaptcha.render(container, {
          sitekey: siteKey,
          theme: 'light'
        });
      } catch (error) {
        if (isInvalidKeyTypeError(error)) {
          recaptchaMode = 'v3';
          recaptchaWidgetId = null;
          return null;
        }
        throw error;
      }

      return recaptchaWidgetId;
    })();

    try {
      return await recaptchaRenderPromise;
    } finally {
      recaptchaRenderPromise = null;
    }
  }

  async function executeRecaptchaV3(siteKey) {
    if (!window.grecaptcha || typeof window.grecaptcha.execute !== 'function') {
      // Ensure v3 api is loaded for site key based execution.
      var scriptId = 'ta-recaptcha-v3-api';
      if (!document.getElementById(scriptId)) {
        var script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.defer = true;
        script.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
        document.head.appendChild(script);
      }
    }

    var ready = await waitForRecaptchaApi(7000, function (grecaptcha) {
      return typeof grecaptcha.execute === 'function';
    });

    if (!ready) {
      throw new Error('reCAPTCHA no esta disponible para ejecucion v3');
    }

    return await new Promise(function (resolve, reject) {
      try {
        window.grecaptcha.ready(function () {
          window.grecaptcha.execute(siteKey, { action: 'document_upload' })
            .then(resolve)
            .catch(reject);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function getRecaptchaToken(containerId) {
    var siteKey = getRecaptchaSiteKey();
    if (!siteKey) return null;

    var widgetId = await ensureRecaptchaWidget(containerId);
    if (recaptchaMode === 'v3' || widgetId === null) {
      var v3Token = await executeRecaptchaV3(siteKey);
      if (!v3Token) {
        throw new Error('No se pudo obtener token de reCAPTCHA v3');
      }
      return v3Token;
    }

    var v2Token = window.grecaptcha.getResponse(widgetId);
    if (!v2Token) {
      throw new Error('Completa reCAPTCHA antes de subir archivos');
    }
    return v2Token;
  }

  function resetRecaptcha() {
    if (recaptchaMode === 'v3') return;
    if (recaptchaWidgetId === null) return;
    if (!window.grecaptcha || typeof window.grecaptcha.reset !== 'function') return;
    window.grecaptcha.reset(recaptchaWidgetId);
  }

  function isMissingMultipartFileError(error) {
    var message = extractErrorMessage(error, '').toLowerCase();
    return message.indexOf("multipart field 'file' is required") >= 0 ||
      message.indexOf('missing_file') >= 0;
  }

  async function parseUploadResponse(response, normalizedFile) {
    var payload = null;
    try {
      payload = await response.json();
    } catch (_err) {
      payload = null;
    }

    if (!response.ok || (payload && payload.ok === false)) {
      var uploadError = extractErrorMessage(payload, 'Error de subida en Apps Script');
      throw new Error(uploadError);
    }

    var driveFileId = payload && payload.drive_file_id ? String(payload.drive_file_id).trim() : '';
    var receipt = payload && payload.receipt ? String(payload.receipt).trim() : '';
    if (!driveFileId || !receipt) {
      throw new Error('Apps Script no devolvio drive_file_id o receipt validos');
    }

    return {
      drive_file_id: driveFileId,
      name: String((payload && payload.name) || normalizedFile.name || driveFileId).trim(),
      mime: String((payload && payload.mime) || normalizedFile.mime || '').trim().toLowerCase(),
      size: Number((payload && payload.size) || normalizedFile.size || 0),
      receipt: receipt
    };
  }

  async function readFileAsBase64(file) {
    return await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('No se pudo leer el archivo seleccionado'));
      };
      reader.onload = function () {
        var result = String(reader.result || '');
        var commaIndex = result.indexOf(',');
        if (commaIndex < 0) {
          reject(new Error('No se pudo codificar el archivo a base64'));
          return;
        }
        resolve(result.slice(commaIndex + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadSingleFileMultipartToAppsScript(file, uploadToken, stagingId) {
    var appsScriptUrl = getAppsScriptUrl();
    if (!appsScriptUrl) {
      throw new Error('APPS_SCRIPT_URL no esta configurado');
    }

    var normalized = normalizeFileObject(file);
    var formData = new FormData();
    formData.append('action', 'upload');
    formData.append('upload_token', uploadToken);
    formData.append('staging_id', stagingId);
    formData.append('file', file, file.name || 'archivo');

    var response;
    try {
      response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'No se pudo conectar con Apps Script');
    }

    return parseUploadResponse(response, normalized);
  }

  async function uploadSingleFileFormBase64ToAppsScript(file, uploadToken, stagingId) {
    var appsScriptUrl = getAppsScriptUrl();
    if (!appsScriptUrl) {
      throw new Error('APPS_SCRIPT_URL no esta configurado');
    }

    var normalized = normalizeFileObject(file);
    var fileBase64 = await readFileAsBase64(file);
    var formData = new FormData();
    formData.append('action', 'upload');
    formData.append('upload_token', uploadToken);
    formData.append('staging_id', stagingId);
    formData.append('file_name', normalized.name || 'archivo');
    formData.append('file_mime', normalized.mime || 'application/octet-stream');
    formData.append('file_size', String(normalized.size || 0));
    formData.append('file_base64', fileBase64);

    var response;
    try {
      response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'No se pudo conectar con Apps Script');
    }

    return parseUploadResponse(response, normalized);
  }

  async function uploadSingleFileToAppsScript(file, uploadToken, stagingId) {
    try {
      return await uploadSingleFileMultipartToAppsScript(file, uploadToken, stagingId);
    } catch (error) {
      if (!isMissingMultipartFileError(error)) {
        throw error;
      }
      return await uploadSingleFileFormBase64ToAppsScript(file, uploadToken, stagingId);
    }
  }

  function getSessionId(explicitSessionId) {
    if (explicitSessionId) return explicitSessionId;
    if (!ns.session || typeof ns.session.getState !== 'function') return null;
    var state = ns.session.getState();
    return state && state.sessionId ? state.sessionId : null;
  }

  async function withSessionPayload(payload) {
    var input = payload || {};
    var sessionId = getSessionId(input.session_id);
    if (!sessionId) {
      return { data: null, error: normalizeError('No hay sesion activa para la operacion de subida') };
    }
    return {
      data: Object.assign({}, input, { session_id: sessionId }),
      error: null
    };
  }

  async function issueToken(payload) {
    var withSession = await withSessionPayload(payload);
    if (withSession.error) return withSession;
    return callEdgeFunction('issue-upload-token', withSession.data);
  }

  async function finalizeUpload(payload) {
    var withSession = await withSessionPayload(payload);
    if (withSession.error) return withSession;
    return callEdgeFunction('finalize-document-upload', withSession.data);
  }

  async function cancelUpload(payload) {
    var withSession = await withSessionPayload(payload);
    if (withSession.error) return withSession;
    return callEdgeFunction('cancel-document-upload', withSession.data);
  }

  async function uploadFiles(files, options) {
    var opts = options || {};
    var fileList = ensureArray(files).filter(Boolean);
    if (!fileList.length) {
      return { data: null, error: normalizeError('No se seleccionaron archivos para subir') };
    }

    if (ns.session && typeof ns.session.init === 'function') {
      await ns.session.init();
    }

    var sessionId = getSessionId(opts.session_id);
    if (!sessionId) {
      return { data: null, error: normalizeError('No hay sesion activa para subir archivos') };
    }

    var manifest = fileList.map(normalizeFileObject);
    var recaptchaToken = null;

    try {
      recaptchaToken = await getRecaptchaToken(opts.recaptchaContainerId || DEFAULT_RECAPTCHA_CONTAINER_ID);
    } catch (err) {
      return { data: null, error: normalizeError(err && err.message ? err.message : 'reCAPTCHA invalido') };
    }

    var tokenResponse = await issueToken({
      session_id: sessionId,
      staging_id: opts.staging_id || null,
      file_manifest: manifest,
      recaptcha_token: recaptchaToken
    });

    resetRecaptcha();

    if (tokenResponse.error || !tokenResponse.data || !tokenResponse.data.staging_id || !tokenResponse.data.upload_token) {
      return { data: null, error: tokenResponse.error || normalizeError('No se pudo emitir upload token') };
    }

    var stagingId = String(tokenResponse.data.staging_id);
    var uploadToken = String(tokenResponse.data.upload_token);
    var uploadedFiles = [];

    for (var i = 0; i < fileList.length; i += 1) {
      try {
        uploadedFiles.push(await uploadSingleFileToAppsScript(fileList[i], uploadToken, stagingId));
      } catch (err) {
        if (uploadedFiles.length) {
          try {
            await finalizeUpload({
              session_id: sessionId,
              staging_id: stagingId,
              uploaded_files: uploadedFiles
            });
          } catch (_finalizeErr) {
            // Best effort only.
          }
        }
        return {
          data: null,
          error: normalizeError(err && err.message ? err.message : 'No se pudo subir uno de los archivos')
        };
      }
    }

    var finalizeResponse = await finalizeUpload({
      session_id: sessionId,
      staging_id: stagingId,
      uploaded_files: uploadedFiles
    });

    if (finalizeResponse.error || !finalizeResponse.data || !finalizeResponse.data.ready_for_submit) {
      return { data: null, error: finalizeResponse.error || normalizeError('No se pudo finalizar la subida') };
    }

    return {
      data: {
        staging_id: stagingId,
        file_count: Number(finalizeResponse.data.file_count || 0),
        files: ensureArray(finalizeResponse.data.files)
      },
      error: null
    };
  }

  ns.upload = {
    issueToken: issueToken,
    uploadFiles: uploadFiles,
    finalizeUpload: finalizeUpload,
    cancelUpload: cancelUpload,
    resetRecaptcha: resetRecaptcha,
    getRecaptchaMode: function () { return recaptchaMode; }
  };
})();
