// ============================================
// SHIM LEGACY: CLIENTE SUPABASE
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || {};
  if (ns.supabaseClient) {
    window.supabaseClient = ns.supabaseClient;
    return;
  }

  if (!window.SUPABASE_CONFIG || typeof window.supabase === 'undefined') {
    console.warn('[participacion] supabase-client legacy no pudo inicializarse');
    return;
  }

  var createClient = window.supabase.createClient;
  if (typeof createClient !== 'function') {
    console.warn('[participacion] createClient no disponible');
    return;
  }

  window.supabaseClient = createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );

  if (ns) ns.supabaseClient = window.supabaseClient;
  console.log('[participacion] Cliente Supabase inicializado por shim legacy');
})();

