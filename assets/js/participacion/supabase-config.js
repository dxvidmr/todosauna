// ============================================
// PARTICIPACION: SUPABASE RUNTIME CONFIG
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.config) return;

  var runtimeConfig = window.__SUPABASE_CONFIG__ || {};

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
