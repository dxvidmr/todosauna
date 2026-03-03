// ============================================
// PARTICIPACION: NORMALIZADOR DE ERRORES
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.errors) return;

  function collectErrorParts(error) {
    if (!error) return [];
    if (typeof error === 'string') return [error];

    var parts = [];

    if (error.message) parts.push(String(error.message));
    if (error.details) parts.push(String(error.details));
    if (error.hint) parts.push(String(error.hint));
    if (error.code) parts.push(String(error.code));

    if (error.error) {
      if (typeof error.error === 'string') {
        parts.push(error.error);
      } else {
        parts = parts.concat(collectErrorParts(error.error));
      }
    }

    return parts;
  }

  function normalizedText(error) {
    return collectErrorParts(error)
      .join(' | ')
      .toLowerCase()
      .trim();
  }

  function getCode(error) {
    var raw = normalizedText(error);
    if (!raw) return null;

    var rateMatch = raw.match(/rate_limit_(session|ip)_exceeded:([a-z_]+)/);
    if (rateMatch) {
      return 'rate_limit_' + rateMatch[1] + '_exceeded:' + rateMatch[2];
    }

    if (raw.indexOf('invalid_session') !== -1) return 'invalid_session';
    if (raw.indexOf('session_id no encontrado') !== -1) return 'session_id_not_found';
    if (raw.indexOf('invalid_email_hash') !== -1) return 'invalid_email_hash';
    if (raw.indexOf('already_exists') !== -1) return 'already_exists';

    if (raw.indexOf('staging_id no encontrado') !== -1) return 'staging_not_found';
    if (raw.indexOf('staging no esta listo para envio') !== -1) return 'staging_not_ready';
    if (raw.indexOf('staging expirado') !== -1) return 'staging_expired';
    if (raw.indexOf('staging sin archivos') !== -1) return 'staging_without_files';
    if (raw.indexOf('staging sin drive_file_id valido') !== -1) return 'staging_invalid_drive_id';

    if (raw.indexOf('recaptcha') !== -1) return 'recaptcha_failed';
    if (raw.indexOf('apps script') !== -1) return 'apps_script_error';
    if (raw.indexOf("multipart field 'file' is required") !== -1) return 'upload_missing_file';

    return null;
  }

  function isRateLimit(error, action) {
    var code = getCode(error);
    if (!code || code.indexOf('rate_limit_') !== 0) return false;
    if (!action) return true;
    return code === 'rate_limit_session_exceeded:' + action || code === 'rate_limit_ip_exceeded:' + action;
  }

  function rateLimitMessage(code) {
    if (!code) return null;

    if (code === 'rate_limit_session_exceeded:submit_evaluacion') {
      return 'Has enviado participaciones muy r\u00e1pido. Espera un minuto y vuelve a intentarlo.';
    }
    if (code === 'rate_limit_ip_exceeded:submit_evaluacion') {
      return 'Hay demasiada actividad desde esta conexi\u00f3n. Espera un minuto y vuelve a intentarlo.';
    }
    if (code === 'rate_limit_session_exceeded:submit_testimonio') {
      return 'Has alcanzado el l\u00edmite de contribuciones para las \u00faltimas 24 horas. Vuelve a intentarlo m\u00e1s tarde.';
    }
    if (code === 'rate_limit_ip_exceeded:submit_testimonio') {
      return 'Hay demasiada actividad desde esta conexi\u00f3n en las \u00faltimas 24 horas. Vuelve a intentarlo m\u00e1s tarde.';
    }
    if (code === 'rate_limit_session_exceeded:submit_contribucion') {
      return 'Has alcanzado el l\u00edmite de contribuciones para las \u00faltimas 24 horas. Vuelve a intentarlo m\u00e1s tarde.';
    }
    if (code === 'rate_limit_ip_exceeded:submit_contribucion') {
      return 'Hay demasiada actividad desde esta conexi\u00f3n en las \u00faltimas 24 horas. Vuelve a intentarlo m\u00e1s tarde.';
    }

    return null;
  }

  function isSafeUserMessage(text) {
    var value = String(text || '').trim();
    if (!value) return false;
    var lowered = value.toLowerCase();

    if (lowered === '[object object]') return false;
    if (lowered.indexOf('sqlstate') !== -1) return false;
    if (lowered.indexOf('rpc_') !== -1) return false;
    if (lowered.indexOf('{') !== -1 || lowered.indexOf('}') !== -1) return false;

    return true;
  }

  function normalizeContext(context) {
    var ctx = String(context || '').trim().toLowerCase();
    return ctx || 'default';
  }

  function defaultMessageByContext(context) {
    var ctx = normalizeContext(context);
    if (ctx === 'evaluacion') return 'No se pudo enviar la evaluaci\u00f3n.';
    if (ctx === 'sugerencia') return 'No se pudo enviar la sugerencia.';
    if (ctx === 'testimonio_submit') return 'No se pudo enviar el testimonio.';
    if (ctx === 'contribucion_submit') return 'No se pudo enviar la contribuci\u00f3n.';
    if (ctx === 'contribucion_upload') return 'No se pudo completar la subida de archivos.';
    if (ctx === 'contribucion_cancel') return 'No se pudo cancelar la subida.';
    if (ctx === 'login') return 'No se pudo identificar la cuenta colaboradora.';
    if (ctx === 'register') return 'No se pudo completar el registro.';
    return 'No se pudo completar la acci\u00f3n.';
  }

  function toUserMessage(error, context, fallback) {
    var code = getCode(error);
    var limitMessage = rateLimitMessage(code);
    if (limitMessage) return limitMessage;

    if (code === 'invalid_session' || code === 'session_id_not_found') {
      return 'No hay una sesi\u00f3n activa v\u00e1lida. Recarga la p\u00e1gina e int\u00e9ntalo de nuevo.';
    }

    if (code === 'invalid_email_hash') {
      return 'No se pudo validar el correo. Int\u00e9ntalo de nuevo.';
    }

    if (code === 'already_exists') {
      return 'Este email ya est\u00e1 registrado. Usa "Identificarme".';
    }

    if (code === 'staging_not_found') {
      return 'No se encontr\u00f3 la subida en curso. Vuelve a subir los archivos.';
    }

    if (code === 'staging_not_ready') {
      return 'La subida a\u00fan no est\u00e1 lista para enviarse. Revisa los archivos y vuelve a intentar.';
    }

    if (code === 'staging_expired') {
      return 'La subida caduc\u00f3. Vuelve a cargar los archivos.';
    }

    if (code === 'staging_without_files' || code === 'staging_invalid_drive_id' || code === 'upload_missing_file') {
      return 'No hay archivos v\u00e1lidos en la subida. Intenta cargar los archivos de nuevo.';
    }

    if (code === 'recaptcha_failed') {
      return 'No se pudo validar reCAPTCHA. Int\u00e9ntalo otra vez.';
    }

    if (code === 'apps_script_error') {
      return 'No se pudo conectar con el servicio de subida. Int\u00e9ntalo de nuevo en unos segundos.';
    }

    var firstPart = collectErrorParts(error)[0] || '';
    if (isSafeUserMessage(firstPart)) {
      return String(firstPart).trim();
    }

    return fallback || defaultMessageByContext(context);
  }

  ns.errors = {
    getCode: getCode,
    toUserMessage: toUserMessage,
    isRateLimit: isRateLimit
  };
})();
