// ============================================
// GESTION DE MODOS DE PARTICIPACION (RPC SAFE)
// ============================================

class UserManager {
  constructor() {
    this.sessionKey = 'fuenteovejuna_session';
    this.debug = false;
  }

  setDebug(on) {
    this.debug = !!on;
  }

  tieneModoDefinido() {
    return sessionStorage.getItem(this.sessionKey) !== null;
  }

  obtenerDatosUsuario() {
    const datos = sessionStorage.getItem(this.sessionKey);
    return datos ? JSON.parse(datos) : null;
  }

  guardarSesion(datos) {
    sessionStorage.setItem(this.sessionKey, JSON.stringify(datos));
  }

  cerrarSesion() {
    sessionStorage.removeItem(this.sessionKey);
    console.log('Sesion cerrada');
  }

  cambiarModo() {
    this.cerrarSesion();
  }

  async hashEmail(email) {
    const normalizado = String(email || '').trim().toLowerCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizado);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async establecerLectorAnonimo() {
    const { data: sesion, error } = await window.SupabaseAPI.createSession(
      'anonimo',
      null
    );

    if (error || !sesion?.session_id) {
      console.error('Error creando sesion anonima:', error);
      return false;
    }

    this.guardarSesion({
      session_id: sesion.session_id,
      modo_participacion: sesion.modo_participacion || 'anonimo'
    });

    console.log('Sesion anonima creada:', sesion.session_id);
    return true;
  }

  async establecerColaborador(email, displayName = null, datosDemograficos = null) {
    const emailHash = await this.hashEmail(email);

    const { data: resultadoRegistro, error: errorRegistro } = await window.SupabaseAPI.registerCollaborator(
      emailHash,
      displayName || null,
      datosDemograficos?.nivel_estudios || null,
      datosDemograficos?.disciplina || null
    );

    if (errorRegistro || !resultadoRegistro) {
      console.error('Error en registro de colaborador:', errorRegistro);
      return false;
    }

    if (!resultadoRegistro.ok) {
      if (resultadoRegistro.reason === 'already_exists') {
        alert('Este email ya esta registrado. Usa "Identificarme" en lugar de "Registrarme".');
      } else {
        alert('No se pudo registrar el colaborador. Intenta de nuevo.');
      }
      return false;
    }

    const colaborador = resultadoRegistro.collaborator;
    const { data: sesion, error: errorSesion } = await window.SupabaseAPI.createSession(
      'colaborador',
      colaborador.collaborator_id
    );

    if (errorSesion || !sesion?.session_id) {
      console.error('Error creando sesion de colaborador:', errorSesion);
      return false;
    }

    this.guardarSesion({
      session_id: sesion.session_id,
      modo_participacion: sesion.modo_participacion || 'colaborador',
      collaborator_id: colaborador.collaborator_id,
      display_name: colaborador.display_name,
      nivel_estudios: colaborador.nivel_estudios || null,
      disciplina: colaborador.disciplina || null
    });

    console.log('Colaborador establecido:', sesion.session_id);
    return true;
  }

  async identificarColaborador(email) {
    const emailHash = await this.hashEmail(email);
    const { data: colaborador, error } = await window.SupabaseAPI.loginCollaborator(emailHash);

    if (error) {
      return { ok: false, found: false, error };
    }

    if (!colaborador?.collaborator_id) {
      return { ok: true, found: false, collaborator: null };
    }

    const { data: sesion, error: errorSesion } = await window.SupabaseAPI.createSession(
      'colaborador',
      colaborador.collaborator_id
    );

    if (errorSesion || !sesion?.session_id) {
      return { ok: false, found: true, error: errorSesion || { message: 'No se pudo crear sesion' } };
    }

    this.guardarSesion({
      session_id: sesion.session_id,
      modo_participacion: sesion.modo_participacion || 'colaborador',
      collaborator_id: colaborador.collaborator_id,
      display_name: colaborador.display_name,
      nivel_estudios: colaborador.nivel_estudios || null,
      disciplina: colaborador.disciplina || null
    });

    return { ok: true, found: true, collaborator };
  }

  obtenerDatosParaEvaluacion() {
    const datos = this.obtenerDatosUsuario();
    return datos ? { session_id: datos.session_id } : null;
  }

  async obtenerEstadisticas() {
    const datos = this.obtenerDatosUsuario();
    if (!datos?.session_id) return null;

    const { data, error } = await window.SupabaseAPI.getSessionStats(datos.session_id);
    if (error || !data) {
      console.error('Error al obtener estadisticas:', error);
      return null;
    }

    return {
      total_evaluaciones: Number(data.total_evaluaciones || 0),
      votos_up: Number(data.votos_up || 0),
      votos_down: Number(data.votos_down || 0),
      comentarios: Number(data.comentarios || 0)
    };
  }
}

window.userManager = new UserManager();
console.log('UserManager inicializado');
