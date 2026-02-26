// ============================================
// CAPA LEGACY DE ACCESO A SUPABASE
// Mantiene lecturas/editorial + evaluaciones.
// Login/registro/sesion se resuelven via legacy-bridge.js.
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  function ensureClient() {
    if (!window.supabaseClient) {
      return { error: { message: 'Cliente Supabase no inicializado' } };
    }
    return null;
  }

  function firstRow(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  function normalizedErrorText(error) {
    if (!error) return '';
    if (typeof error === 'string') return error.toLowerCase();
    return [
      error.message,
      error.details,
      error.hint,
      error.code
    ]
      .filter(Boolean)
      .join(' | ')
      .toLowerCase();
  }

  function getParticipationRateLimitMessage(error) {
    if (window.Participacion?.errors?.isRateLimit) {
      var isRateLimited = window.Participacion.errors.isRateLimit(error, 'submit_evaluacion');
      if (!isRateLimited) return null;
      return getParticipationUserMessage(error, 'evaluacion', null);
    }

    var raw = normalizedErrorText(error);
    if (!raw) return null;

    if (raw.indexOf('rate_limit_session_exceeded:submit_evaluacion') !== -1) {
      return 'Has enviado participaciones muy r\u00e1pido. Espera un minuto y vuelve a intentarlo.';
    }

    if (raw.indexOf('rate_limit_ip_exceeded:submit_evaluacion') !== -1) {
      return 'Hay demasiada actividad desde esta conexi\u00f3n. Espera un minuto y vuelve a intentarlo.';
    }

    return null;
  }

  function getParticipationUserMessage(error, context, fallback) {
    if (window.Participacion?.errors?.toUserMessage) {
      return window.Participacion.errors.toUserMessage(error, context, fallback);
    }

    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback.trim();
    }

    return null;
  }

  async function callRpc(functionName, params, options) {
    var rpcParams = params || {};
    var rpcOptions = options || {};
    var missingClient = ensureClient();
    if (missingClient) return { data: null, error: missingClient.error };

    var result = await window.supabaseClient.rpc(functionName, rpcParams);
    if (result.error) return { data: null, error: result.error };
    if (rpcOptions.single) return { data: firstRow(result.data), error: null };
    return { data: result.data, error: null };
  }

  // Preserve methods injected previously by legacy bridge.
  var existing = window.SupabaseAPI || {};

  var SupabaseAPI = Object.assign(existing, {
    async getPasajes() {
      var missingClient = ensureClient();
      if (missingClient) return { data: null, error: missingClient.error };
      return window.supabaseClient
        .from('pasajes')
        .select('*')
        .order('orden', { ascending: true });
    },

    async getNotasActivas() {
      var missingClient = ensureClient();
      if (missingClient) return { data: null, error: missingClient.error };
      return window.supabaseClient
        .from('notas_activas')
        .select('*');
    },

    async getNotaVersion(notaId) {
      var missingClient = ensureClient();
      if (missingClient) return { data: null, error: missingClient.error };
      return window.supabaseClient
        .from('notas_activas')
        .select('version')
        .eq('nota_id', notaId)
        .single();
    },

    async submitParticipationEvent(payload) {
      return callRpc(
        'rpc_submit_participation_event',
        {
          p_source: payload.source,
          p_event_type: payload.event_type,
          p_session_id: payload.session_id,
          p_pasaje_id: payload.pasaje_id,
          p_nota_id: payload.nota_id,
          p_nota_version: payload.nota_version,
          p_target_xmlid: payload.target_xmlid,
          p_vote: payload.vote,
          p_selected_text: payload.selected_text,
          p_comment: payload.comment
        },
        { single: true }
      );
    },

    async submitNoteEvaluation(payload) {
      return this.submitParticipationEvent({
        source: payload.source,
        event_type: 'nota_eval',
        session_id: payload.session_id,
        pasaje_id: payload.pasaje_id || null,
        nota_id: payload.nota_id,
        nota_version: payload.nota_version,
        target_xmlid: null,
        vote: payload.vote,
        selected_text: null,
        comment: payload.comment || null
      });
    },

    async submitMissingNoteSuggestion(payload) {
      return this.submitParticipationEvent({
        source: payload.source,
        event_type: 'falta_nota',
        session_id: payload.session_id,
        pasaje_id: payload.pasaje_id || null,
        nota_id: null,
        nota_version: null,
        target_xmlid: payload.target_xmlid || null,
        vote: null,
        selected_text: payload.selected_text || null,
        comment: payload.comment || null
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

    getParticipationRateLimitMessage(error) {
      return getParticipationRateLimitMessage(error);
    },

    getParticipationUserMessage(error, context, fallback) {
      return getParticipationUserMessage(error, context, fallback);
    }
  });

  window.SupabaseAPI = SupabaseAPI;
})();
