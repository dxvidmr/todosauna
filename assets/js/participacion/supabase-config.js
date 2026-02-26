// ============================================
// PARTICIPACION: SUPABASE RUNTIME CONFIG
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.config) {
    window.SUPABASE_CONFIG = {
      url: ns.config.url,
      anonKey: ns.config.publishableKey
    };
    return;
  }

  var runtimeConfig = window.__SUPABASE_CONFIG__ || {};
  var legacyConfig = window.SUPABASE_CONFIG || {};
  var publishableKey =
    runtimeConfig.publishableKey ||
    runtimeConfig.anonKey ||
    legacyConfig.publishableKey ||
    legacyConfig.anonKey ||
    '';
  var geonamesUsername =
    runtimeConfig.geonamesUsername ||
    runtimeConfig.geonames_username ||
    window.GEONAMES_USERNAME ||
    '';
  var recaptchaSiteKey =
    runtimeConfig.recaptchaSiteKey ||
    runtimeConfig.recaptcha_site_key ||
    window.RECAPTCHA_SITE_KEY ||
    '';
  var recaptchaMode =
    runtimeConfig.recaptchaMode ||
    runtimeConfig.recaptcha_mode ||
    window.RECAPTCHA_MODE ||
    'auto';
  var appsScriptUrl =
    runtimeConfig.appsScriptUrl ||
    runtimeConfig.apps_script_url ||
    window.APPS_SCRIPT_URL ||
    '';

  var config = {
    url: runtimeConfig.url || legacyConfig.url || 'https://wlpzbxsgghsjffzycqku.supabase.co',
    publishableKey: publishableKey || 'sb_publishable_PCcxvIOQ06pshIdlXFBKew_xoo5KW_a',
    geonamesUsername: geonamesUsername,
    recaptchaSiteKey: recaptchaSiteKey,
    recaptchaMode: String(recaptchaMode || 'auto').trim().toLowerCase(),
    appsScriptUrl: appsScriptUrl
  };

  if (!config.url || !config.publishableKey) {
    console.warn('[participacion] Configuracion de Supabase incompleta');
  }

  ns.config = config;

  // Legacy aliases used by lectura scripts.
  window.SUPABASE_CONFIG = {
    url: config.url,
    anonKey: config.publishableKey
  };
})();
