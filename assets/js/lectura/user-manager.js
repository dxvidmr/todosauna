// ============================================
// SHIM LEGACY: USER MANAGER
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || {};
  if (typeof ns.applyLegacyBridge === 'function') {
    ns.applyLegacyBridge();
  }

  if (window.userManager && window.userManager.__participacionLegacyBridge) {
    console.log('[participacion] user-manager.js funcionando como shim');
    return;
  }

  console.warn('[participacion] user-manager legacy no pudo enlazarse al bridge');
})();

