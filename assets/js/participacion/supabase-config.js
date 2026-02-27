// ============================================
// PARTICIPACION: SUPABASE RUNTIME CONFIG
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.config) return;

  function readRuntimeConfigFromJsonScript() {
    var element = document.getElementById('participacion-runtime-config');
    if (!element) return null;

    try {
      var parsed = JSON.parse(element.textContent || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch (error) {
      console.warn('[participacion] No se pudo parsear participacion-runtime-config', error);
      return null;
    }
  }

  var runtimeConfig = readRuntimeConfigFromJsonScript() || window.__SUPABASE_CONFIG__ || {};

  var config = {
    url: String(runtimeConfig.url || '').trim(),
    publishableKey: String(runtimeConfig.publishableKey || '').trim(),
    geonamesUsername: String(runtimeConfig.geonamesUsername || '').trim(),
    recaptchaSiteKey: String(runtimeConfig.recaptchaSiteKey || '').trim(),
    recaptchaMode: String(runtimeConfig.recaptchaMode || 'auto').trim().toLowerCase(),
    appsScriptUrl: String(runtimeConfig.appsScriptUrl || '').trim()
  };

  if (!config.url || !config.publishableKey) {
    console.warn('[participacion] Configuracion de Supabase incompleta');
  }

  ns.config = config;
})();
