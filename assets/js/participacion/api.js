// ============================================
// PARTICIPACION: SUPABASE API V2
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.apiV2) return;

  function ensureClient() {
    if (!ns.supabaseClient) {
      return { error: { message: 'Cliente Supabase no inicializado' } };
    }

    return null;
  }

  function firstRow(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  async function callRpc(functionName, params, options) {
    var rpcParams = params || {};
    var rpcOptions = options || {};
    var missingClient = ensureClient();
    if (missingClient) {
      return { data: null, error: missingClient.error };
    }

    try {
      var result = await ns.supabaseClient.rpc(functionName, rpcParams);
      if (result.error) return { data: null, error: result.error };
      if (rpcOptions.single) return { data: firstRow(result.data), error: null };
      return { data: result.data, error: null };
    } catch (err) {
      return { data: null, error: { message: err && err.message ? err.message : 'RPC fallo' } };
    }
  }

  async function callQuery(buildQuery, options) {
    var queryOptions = options || {};
    var missingClient = ensureClient();
    if (missingClient) {
      return { data: null, error: missingClient.error };
    }

    try {
      var query = buildQuery(ns.supabaseClient);
      var result = await query;
      if (result.error) return { data: null, error: result.error };
      if (queryOptions.single) return { data: firstRow(result.data), error: null };
      return { data: result.data, error: null };
    } catch (err) {
      return { data: null, error: { message: err && err.message ? err.message : 'Query fallo' } };
    }
  }

  function getParticipationUserMessage(error, context, fallback) {
    if (ns.errors && typeof ns.errors.toUserMessage === 'function') {
      return ns.errors.toUserMessage(error, context, fallback);
    }

    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback.trim();
    }

    return null;
  }

  ns.apiV2 = {
    async bootstrapSession(browserSessionToken) {
      return callRpc(
        'rpc_bootstrap_session',
        { p_browser_session_token: browserSessionToken || null },
        { single: true }
      );
    },

    async setModeAnonimo(sessionId) {
      return callRpc(
        'rpc_set_mode_anonimo',
        { p_session_id: sessionId },
        { single: true }
      );
    },

    async registerAndBindSession(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_collaborator_register_and_bind_session',
        {
          p_session_id: input.sessionId || null,
          p_email_hash: input.emailHash || null,
          p_display_name: input.displayName || null,
          p_nivel_estudios: input.nivelEstudios || null,
          p_disciplina: input.disciplina || null
        },
        { single: true }
      );
    },

    async loginAndBindSession(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_collaborator_login_and_bind_session',
        {
          p_session_id: input.sessionId || null,
          p_email_hash: input.emailHash || null
        },
        { single: true }
      );
    },

    async submitTestimonio(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_submit_testimonio',
        {
          p_session_id: input.session_id,
          p_titulo: input.titulo,
          p_testimonio: input.testimonio,
          p_experiencia_fecha: input.experiencia_fecha || null,
          p_experiencia_fecha_texto: input.experiencia_fecha_texto || null,
          p_experiencia_ciudad_nombre: input.experiencia_ciudad_nombre || null,
          p_experiencia_ciudad_geoname_id: input.experiencia_ciudad_geoname_id || null,
          p_experiencia_pais_nombre: input.experiencia_pais_nombre || null,
          p_experiencia_pais_geoname_id: input.experiencia_pais_geoname_id || null,
          p_experiencia_lugar_texto: input.experiencia_lugar_texto || null,
          p_experiencia_contexto: input.experiencia_contexto || null,
          p_experiencia_rango_edad: input.experiencia_rango_edad || null,
          p_linked_archive_refs: input.linked_archive_refs || null,
          p_privacy_settings: input.privacy_settings || null,
          p_privacy_consent: input.privacy_consent,
          p_privacy_consent_version: input.privacy_consent_version || null,
          p_privacy_consent_at: input.privacy_consent_at || null
        },
        { single: true }
      );
    },

    async submitContribucion(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_submit_contribucion_archivo',
        {
          p_session_id: input.session_id,
          p_titulo: input.titulo,
          p_descripcion: input.descripcion || null,
          p_creadores: input.creadores || null,
          p_fecha: input.fecha || null,
          p_fecha_texto: input.fecha_texto || null,
          p_ciudad_nombre: input.ciudad_nombre || null,
          p_ciudad_geoname_id: input.ciudad_geoname_id || null,
          p_pais_nombre: input.pais_nombre || null,
          p_pais_geoname_id: input.pais_geoname_id || null,
          p_lugar_texto: input.lugar_texto || null,
          p_linked_archive_refs: input.linked_archive_refs || null,
          p_rights_type: input.rights_type || null,
          p_rights_holder: input.rights_holder || null,
          p_drive_file_ids: input.drive_file_ids || null,
          p_privacy_consent: input.privacy_consent,
          p_privacy_consent_version: input.privacy_consent_version || null,
          p_privacy_consent_at: input.privacy_consent_at || null
        },
        { single: true }
      );
    },

    async submitContribucionStaged(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_submit_contribucion_archivo_staged',
        {
          p_session_id: input.session_id,
          p_staging_id: input.staging_id,
          p_titulo: input.titulo,
          p_descripcion: input.descripcion || null,
          p_creadores: input.creadores || null,
          p_fecha: input.fecha || null,
          p_fecha_texto: input.fecha_texto || null,
          p_ciudad_nombre: input.ciudad_nombre || null,
          p_ciudad_geoname_id: input.ciudad_geoname_id || null,
          p_pais_nombre: input.pais_nombre || null,
          p_pais_geoname_id: input.pais_geoname_id || null,
          p_lugar_texto: input.lugar_texto || null,
          p_linked_archive_refs: input.linked_archive_refs || null,
          p_rights_type: input.rights_type || null,
          p_rights_holder: input.rights_holder || null,
          p_privacy_consent: input.privacy_consent,
          p_privacy_consent_version: input.privacy_consent_version || null,
          p_privacy_consent_at: input.privacy_consent_at || null
        },
        { single: true }
      );
    },

    async linkTestimonioContribucion(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_link_testimonio_contribucion',
        {
          p_session_id: input.session_id,
          p_testimonio_id: input.testimonio_id,
          p_contribucion_id: input.contribucion_id,
          p_declared_from: input.declared_from
        },
        { single: true }
      );
    },

    async listTestimoniosPublicos(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_list_testimonios_publicos',
        {
          p_limit: input.limit || 20,
          p_offset: input.offset || 0
        }
      );
    },

    async getPasajes() {
      return callQuery(function (client) {
        return client
          .from('pasajes')
          .select('*')
          .order('orden', { ascending: true });
      });
    },

    async getNotasActivas() {
      return callQuery(function (client) {
        return client
          .from('notas_activas')
          .select('*');
      });
    },

    async getNotaVersion(notaId) {
      return callQuery(function (client) {
        return client
          .from('notas_activas')
          .select('version')
          .eq('nota_id', notaId)
          .single();
      }, { single: true });
    },

    async submitParticipationEvent(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_submit_participation_event',
        {
          p_source: input.source,
          p_event_type: input.event_type,
          p_session_id: input.session_id,
          p_pasaje_id: input.pasaje_id || null,
          p_nota_id: input.nota_id || null,
          p_nota_version: input.nota_version || null,
          p_target_xmlid: input.target_xmlid || null,
          p_vote: input.vote || null,
          p_selected_text: input.selected_text || null,
          p_comment: input.comment || null
        },
        { single: true }
      );
    },

    async submitNoteEvaluation(payload) {
      var input = payload || {};
      return this.submitParticipationEvent({
        source: input.source,
        event_type: 'nota_eval',
        session_id: input.session_id,
        pasaje_id: input.pasaje_id || null,
        nota_id: input.nota_id,
        nota_version: input.nota_version,
        target_xmlid: null,
        vote: input.vote,
        selected_text: null,
        comment: input.comment || null
      });
    },

    async submitMissingNoteSuggestion(payload) {
      var input = payload || {};
      return this.submitParticipationEvent({
        source: input.source,
        event_type: 'falta_nota',
        session_id: input.session_id,
        pasaje_id: input.pasaje_id || null,
        nota_id: null,
        nota_version: null,
        target_xmlid: input.target_xmlid || null,
        vote: null,
        selected_text: input.selected_text || null,
        comment: input.comment || null
      });
    },

    async getSessionEvaluatedNotes(sessionId) {
      return callRpc('rpc_get_session_evaluated_notes', { p_session_id: sessionId });
    },

    async getSessionStats(sessionId) {
      return callRpc('rpc_get_session_stats', { p_session_id: sessionId }, { single: true });
    },

    async getNoteEvalCounts() {
      return callRpc('rpc_get_note_eval_counts');
    },

    async getGlobalStats() {
      return callRpc('rpc_get_global_stats', {}, { single: true });
    },

    getParticipationUserMessage: function (error, context, fallback) {
      return getParticipationUserMessage(error, context, fallback);
    },

    async trackFunnelEvent(payload) {
      var input = payload || {};
      return callRpc(
        'rpc_track_participacion_funnel_event',
        {
          p_session_id: input.session_id || null,
          p_event_name: input.event_name || null,
          p_context: input.context || 'lectura',
          p_metadata: input.metadata || {}
        },
        { single: true }
      );
    }
  };
})();
