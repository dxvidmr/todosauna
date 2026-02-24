// ============================================
// SHIM LEGACY: CONFIGURACION SUPABASE
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || {};
  if (ns.config) {
    window.SUPABASE_CONFIG = {
      url: ns.config.url,
      anonKey: ns.config.publishableKey
    };
    return;
  }

  console.warn('[participacion] Cargando fallback legacy de config.js');
  var runtimeConfig = window.__SUPABASE_CONFIG__ || {};
  window.SUPABASE_CONFIG = {
    url: runtimeConfig.url || '',
    anonKey: runtimeConfig.anonKey || runtimeConfig.publishableKey || ''
  };
})();
