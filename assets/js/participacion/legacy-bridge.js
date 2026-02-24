// ============================================
// PARTICIPACION: LEGACY BRIDGE
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});

  function simpleError(message) {
    return { message: message };
  }

  function buildSupabaseLegacyMethods() {
    var api = window.SupabaseAPI || {};
    if (api.__participacionLegacyBridge) return api;

    api.createSession = async function (modoParticipacion, collaboratorId) {
      if (!ns.session) {
        return { data: null, error: simpleError('Session manager no disponible') };
      }

      await ns.session.init();

      if (modoParticipacion === 'anonimo') {
        var anonResult = await ns.session.setAnonimo();
        if (!anonResult.ok) return { data: null, error: anonResult.error || simpleError('No se pudo activar anonimo') };

        return {
          data: {
            session_id: anonResult.session.session_id,
            modo_participacion: 'anonimo',
            collaborator_id: null,
            created_at: anonResult.session.created_at || null
          },
          error: null
        };
      }

      var state = ns.session.getState();
      if (modoParticipacion === 'colaborador' && state.collaboratorId && (!collaboratorId || state.collaboratorId === collaboratorId)) {
        return {
          data: {
            session_id: state.sessionId,
            modo_participacion: 'colaborador',
            collaborator_id: state.collaboratorId,
            created_at: state.createdAt || null
          },
          error: null
        };
      }

      return { data: null, error: simpleError('Usa register/login bind v2 para colaborador') };
    };

    api.registerCollaborator = async function (emailHash, displayName, nivelEstudios, disciplina) {
      if (!ns.apiV2 || !ns.session) {
        return { data: null, error: simpleError('Capa v2 no disponible') };
      }

      await ns.session.init();
      var state = ns.session.getState();
      if (!state.sessionId) {
        return { data: null, error: simpleError('Sesion no disponible') };
      }

      var result = await ns.apiV2.registerAndBindSession({
        sessionId: state.sessionId,
        emailHash: emailHash || null,
        displayName: displayName || null,
        nivelEstudios: nivelEstudios || null,
        disciplina: disciplina || null
      });

      if (result.error) return { data: null, error: result.error };

      if (result.data && result.data.ok) {
        await ns.session.refreshFromServer('colaborador');
      }

      return { data: result.data || null, error: null };
    };

    api.loginCollaborator = async function (emailHash) {
      if (!ns.apiV2 || !ns.session) {
        return { data: null, error: simpleError('Capa v2 no disponible') };
      }

      await ns.session.init();
      var state = ns.session.getState();
      if (!state.sessionId) {
        return { data: null, error: simpleError('Sesion no disponible') };
      }

      var result = await ns.apiV2.loginAndBindSession({
        sessionId: state.sessionId,
        emailHash: emailHash || null
      });

      if (result.error) return { data: null, error: result.error };
      if (!result.data || !result.data.ok || !result.data.found) return { data: null, error: null };
      await ns.session.refreshFromServer('colaborador');
      return { data: result.data.collaborator || null, error: null };
    };

    api.__participacionLegacyBridge = true;
    window.SupabaseAPI = api;
    return api;
  }

  function buildUserManager() {
    if (window.userManager && window.userManager.__participacionLegacyBridge) {
      return window.userManager;
    }

    var manager = {
      __participacionLegacyBridge: true,
      sessionKey: 'fuenteovejuna_session',
      debug: false,

      setDebug: function (on) {
        manager.debug = !!on;
      },

      tieneModoDefinido: function () {
        if (!ns.session) return false;
        return ns.session.isModeDefined();
      },

      obtenerDatosUsuario: function () {
        if (!ns.session) return null;
        return ns.session.getLegacyUserData();
      },

      guardarSesion: function () {
        // Persistencia gestionada por session-manager.js.
      },

      cerrarSesion: function () {
        if (!ns.session) return Promise.resolve({ ok: false });
        return ns.session.resetToUnasked();
      },

      cambiarModo: function () {
        return manager.cerrarSesion();
      },

      hashEmail: async function (email) {
        if (!ns.session) throw new Error('Session manager no disponible');
        return ns.session.hashEmail(email);
      },

      establecerLectorAnonimo: async function () {
        if (!ns.session) return false;
        var result = await ns.session.setAnonimo();
        return !!result.ok;
      },

      establecerColaborador: async function (email, displayName, datosDemograficos) {
        if (!ns.session) return false;

        var profile = datosDemograficos || null;
        var result = await ns.session.registerAndBind(email, displayName || null, profile);
        return !!result.ok;
      },

      identificarColaborador: async function (email) {
        if (!ns.session) {
          return { ok: false, found: false, error: simpleError('Session manager no disponible') };
        }

        var result = await ns.session.loginAndBind(email);

        if (!result.ok) {
          return { ok: false, found: false, error: result.error || simpleError(result.reason || 'login_error') };
        }

        if (!result.found) {
          return { ok: true, found: false, collaborator: null };
        }

        return { ok: true, found: true, collaborator: result.collaborator || null };
      },

      obtenerDatosParaEvaluacion: function () {
        var datos = manager.obtenerDatosUsuario();
        return datos ? { session_id: datos.session_id } : null;
      },

      obtenerEstadisticas: async function () {
        if (!ns.session) return null;
        return ns.session.getStats();
      }
    };

    window.userManager = manager;
    return manager;
  }

  function buildModalBridge() {
    if (window.modalModo && window.modalModo.__participacionLegacyBridge) {
      return window.modalModo;
    }

    var modalBridge = {
      __participacionLegacyBridge: true,
      mostrar: function (options) {
        if (!ns.modal) return Promise.resolve();
        return ns.modal.open(options || {});
      },
      cerrar: function () {
        if (!ns.modal) return;
        ns.modal.close();
      },
      mostrarInfoUsuario: function () {
        if (!ns.modal) return Promise.resolve();
        return ns.modal.showProfile();
      }
    };

    window.modalModo = modalBridge;
    return modalBridge;
  }

  function applyLegacyBridge() {
    buildSupabaseLegacyMethods();
    buildUserManager();
    buildModalBridge();
  }

  ns.applyLegacyBridge = applyLegacyBridge;
  applyLegacyBridge();
  console.log('[participacion] Legacy bridge activo');
})();
