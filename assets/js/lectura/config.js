// ============================================
// CONFIGURACION DE SUPABASE
// ============================================

// Nota: la publishable key siempre es visible en cliente.
// Para rotacion sin tocar este archivo, se puede inyectar:
// window.__SUPABASE_CONFIG__ = { url: '...', anonKey: '...' };

const runtimeConfig = window.__SUPABASE_CONFIG__ || {};

const SUPABASE_CONFIG = {
  url: runtimeConfig.url || 'https://wlpzbxsgghsjffzycqku.supabase.co',
  anonKey: runtimeConfig.anonKey || 'sb_publishable_PCcxvIOQ06pshIdlXFBKew_xoo5KW_a'
};

if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
  console.error('Configuracion de Supabase incompleta');
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
