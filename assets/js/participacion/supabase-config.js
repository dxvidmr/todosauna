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
  var publishableKey = runtimeConfig.publishableKey || runtimeConfig.anonKey || '';

  var config = {
    url: runtimeConfig.url || 'https://wlpzbxsgghsjffzycqku.supabase.co',
    publishableKey: publishableKey || 'sb_publishable_PCcxvIOQ06pshIdlXFBKew_xoo5KW_a'
  };

  if (!config.url || !config.publishableKey) {
    console.error('[participacion] Configuracion de Supabase incompleta');
  }

  ns.config = config;

  // Legacy aliases used by lectura scripts.
  window.SUPABASE_CONFIG = {
    url: config.url,
    anonKey: config.publishableKey
  };
})();

