// ============================================
// CAPA SEGURA DE ACCESO A SUPABASE (RPC + CONTENIDO PUBLICO)
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

  async function callRpc(functionName, params = {}, options = {}) {
    const missingClient = ensureClient();
    if (missingClient) return { data: null, error: missingClient.error };

    const { data, error } = await window.supabaseClient.rpc(functionName, params);
    if (error) return { data: null, error };

    if (options.single) {
      return { data: firstRow(data), error: null };
    }

    return { data, error: null };
  }

  const SupabaseAPI = {
    // ---------- Lectura de contenido editorial (permitido por RLS) ----------
    async getPasajes() {
      const missingClient = ensureClient();
      if (missingClient) return { data: null, error: missingClient.error };

      return window.supabaseClient
        .from('pasajes')
        .select('*')
        .order('orden', { ascending: true });
    },

    async getNotasActivas() {
      const missingClient = ensureClient();
      if (missingClient) return { data: null, error: missingClient.error };

      return window.supabaseClient
        .from('notas_activas')
        .select('*');
    },

    async getNotaVersion(notaId) {
      const missingClient = ensureClient();
      if (missingClient) return { data: null, error: missingClient.error };

      return window.supabaseClient
        .from('notas_activas')
        .select('version')
        .eq('nota_id', notaId)
        .single();
    },

    // ---------- Participacion (solo por RPC) ----------
    async loginCollaborator(emailHash) {
      return callRpc('rpc_collaborator_login', { p_email_hash: emailHash }, { single: true });
    },

    async registerCollaborator(emailHash, displayName, nivelEstudios, disciplina) {
      return callRpc(
        'rpc_collaborator_register',
        {
          p_email_hash: emailHash,
          p_display_name: displayName,
          p_nivel_estudios: nivelEstudios,
          p_disciplina: disciplina
        },
        { single: true }
      );
    },

    async createSession(modoParticipacion, collaboratorId) {
      return callRpc(
        'rpc_create_session',
        {
          p_modo_participacion: modoParticipacion,
          p_collaborator_id: collaboratorId
        },
        { single: true }
      );
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
      return callRpc(
        'rpc_get_session_evaluated_notes',
        { p_session_id: sessionId }
      );
    },

    async getSessionStats(sessionId) {
      return callRpc(
        'rpc_get_session_stats',
        { p_session_id: sessionId },
        { single: true }
      );
    },

    async getNoteEvalCounts() {
      return callRpc('rpc_get_note_eval_counts');
    },

    async getGlobalStats() {
      return callRpc('rpc_get_global_stats', {}, { single: true });
    }
  };

  window.SupabaseAPI = SupabaseAPI;
})();
