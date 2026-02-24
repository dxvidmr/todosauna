// ============================================
// SHIM LEGACY: MODAL MODO
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || {};
  if (typeof ns.applyLegacyBridge === 'function') {
    ns.applyLegacyBridge();
  }

  if (window.modalModo && window.modalModo.__participacionLegacyBridge) {
    console.log('[participacion] modal-modo.js funcionando como shim');
    return;
  }

  if (ns.modal) {
    window.modalModo = {
      __participacionLegacyBridge: true,
      mostrar: function (options) {
        return ns.modal.open(options || {});
      },
      cerrar: function () {
        ns.modal.close();
      },
      mostrarInfoUsuario: function () {
        return ns.modal.showProfile();
      }
    };
    return;
  }

  console.warn('[participacion] modal legacy no pudo enlazarse al bridge');
})();

