// ============================================
// PARTICIPACION: SUPABASE CLIENT
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});

  if (ns.supabaseClient) {
    window.supabaseClient = ns.supabaseClient;
    return;
  }

  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.error('[participacion] La libreria @supabase/supabase-js no esta cargada');
    return;
  }

  var config = ns.config || window.SUPABASE_CONFIG;
  var url = config && config.url;
  var key = config && (config.publishableKey || config.anonKey);

  if (!url || !key) {
    console.error('[participacion] No se pudo inicializar Supabase: faltan URL/key');
    return;
  }

  ns.supabaseClient = window.supabase.createClient(url, key);
  window.supabaseClient = ns.supabaseClient;
  console.log('[participacion] Cliente Supabase inicializado');
})();

