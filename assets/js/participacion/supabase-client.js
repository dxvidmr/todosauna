// ============================================
// PARTICIPACION: SUPABASE CLIENT
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});

  if (ns.supabaseClient) return;

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
})();
