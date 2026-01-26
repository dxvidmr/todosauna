// ============================================
// CLIENTE SUPABASE (inicializado)
// ============================================

// Esperar a que se cargue la librería de Supabase desde CDN
(function() {
  // Verificar que config.js ya se cargó
  if (!window.SUPABASE_CONFIG) {
    console.error('Error: config.js debe cargarse antes que supabase-client.js');
    return;
  }
  
  // Verificar que la librería de Supabase esté cargada
  if (typeof supabase === 'undefined') {
    console.error('Error: La librería @supabase/supabase-js no está cargada');
    return;
  }
  
  // Crear cliente
  const { createClient } = supabase;
  window.supabaseClient = createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
  
  console.log('Cliente Supabase inicializado');
})();
