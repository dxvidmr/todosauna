// ============================================
// PARTICIPACION: SUPABASE INIT (CONFIG + CLIENT)
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});

  // --- Config ---
  if (!ns.config) {
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

    ns.config = {
      url: String(runtimeConfig.url || '').trim(),
      publishableKey: String(runtimeConfig.publishableKey || '').trim(),
      geonamesUsername: String(runtimeConfig.geonamesUsername || '').trim(),
      recaptchaSiteKey: String(runtimeConfig.recaptchaSiteKey || '').trim(),
      recaptchaMode: String(runtimeConfig.recaptchaMode || 'auto').trim().toLowerCase(),
      appsScriptUrl: String(runtimeConfig.appsScriptUrl || '').trim()
    };

    if (!ns.config.url || !ns.config.publishableKey) {
      console.warn('[participacion] Configuracion de Supabase incompleta');
    }
  }

  // --- Client ---
  if (!ns.supabaseClient) {
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      console.error('[participacion] La libreria @supabase/supabase-js no esta cargada');
      return;
    }

    var config = ns.config;
    var url = config && config.url;
    var key = config && config.publishableKey;

    if (!url || !key) {
      console.error('[participacion] No se pudo inicializar Supabase: faltan URL/key');
      return;
    }

    ns.supabaseClient = window.supabase.createClient(url, key);
    console.log('[participacion] Cliente Supabase inicializado');
  }
})();
