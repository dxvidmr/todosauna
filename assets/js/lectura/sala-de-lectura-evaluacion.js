// ============================================
// SISTEMA DE EVALUACIÓN EN EDICIÓN
// ============================================

class EdicionEvaluacion {
  constructor() {
    this.notasEvaluadasLocal = new Set(); // Notas evaluadas en esta sesión
    this.notasEvaluadasBD = new Set();    // Notas evaluadas previamente (de BD)
  }
  
  /**
   * Inicializar sistema de evaluación
   * Llamar DESPUÉS de que processNotes() haya terminado
   */
  async init() {
    console.log('Inicializando sistema de evaluación en edición...');
    
    // Cargar notas ya evaluadas por este usuario
    await this.cargarNotasYaEvaluadas();
    
    // Esperar a que las notas estén renderizadas
    const checkNotas = setInterval(() => {
      const noteContentDiv = document.getElementById('noteContent');
      if (noteContentDiv) {
        this.setupEvaluationListeners();
        clearInterval(checkNotas);
      }
    }, 100);
  }
  
  /**
   * Cargar notas que el usuario ya evaluó previamente
   */
  async cargarNotasYaEvaluadas() {
    try {
      const datosUsuario = window.userManager?.obtenerDatosUsuario();
      if (!datosUsuario?.session_id) return;
      
      const { data, error } = await window.supabaseClient
        .from('evaluaciones')
        .select('nota_id')
        .eq('session_id', datosUsuario.session_id);
      
      if (!error && data) {
        data.forEach(e => this.notasEvaluadasBD.add(e.nota_id));
        console.log(`${this.notasEvaluadasBD.size} notas ya evaluadas cargadas`);
      }
    } catch (err) {
      console.warn('No se pudieron cargar evaluaciones previas:', err);
    }
  }
  
  /**
   * Verificar si una nota ya fue evaluada
   */
  estaEvaluada(notaId) {
    return this.notasEvaluadasLocal.has(notaId) || this.notasEvaluadasBD.has(notaId);
  }
  
  /**
   * Configurar listeners para evaluación cuando se muestra una nota
   */
  setupEvaluationListeners() {
    const noteContentDiv = document.getElementById('noteContent');
    
    // Usar MutationObserver para detectar cuando cambia el contenido de la nota
    const observer = new MutationObserver(() => {
      this.addEvaluationButtons();
    });
    
    observer.observe(noteContentDiv, {
      childList: true,
      subtree: true
    });
    
    console.log('Listeners de evaluación configurados');
  }
  
  /**
   * Añadir botones de evaluación a la nota actual
   */
  addEvaluationButtons() {
    const noteContentDiv = document.getElementById('noteContent');
    if (!noteContentDiv) return;
    
    // Buscar el ID de la nota actual en el contenido
    const noteDisplay = noteContentDiv.querySelector('.note-display');
    let notaId = noteDisplay?.dataset?.noteId || null;
    if (!notaId) {
      const noteIdMatch = noteContentDiv.innerHTML.match(/ID:\s*([^\s<]+)/);
      if (!noteIdMatch) return;
      notaId = noteIdMatch[1];
    }
    
    // Evitar añadir botones duplicados
    if (noteContentDiv.querySelector('.nota-evaluacion') || noteContentDiv.querySelector('.nota-ya-evaluada')) return;
    
    // Verificar si ya fue evaluada
    if (this.estaEvaluada(notaId)) {
      // Mostrar mensaje de "ya evaluada"
      const yaEvaluadaDiv = document.createElement('div');
      yaEvaluadaDiv.className = 'nota-ya-evaluada';
      yaEvaluadaDiv.innerHTML = '<i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada';
      
      const noteFooter = noteContentDiv.querySelector('.note-footer');
      if (noteFooter) {
        noteFooter.parentNode.insertBefore(yaEvaluadaDiv, noteFooter);
      } else {
        noteContentDiv.appendChild(yaEvaluadaDiv);
      }
      return;
    }
    
    // Obtener versión de la nota desde Supabase
    this.obtenerVersionNota(notaId).then(version => {
      if (!version) return;
      
      // Obtener estadísticas de evaluaciones
      const evaluaciones = typeof obtenerEvaluacionesStats === 'function'
        ? obtenerEvaluacionesStats(notaId)
        : { total: 0, utiles: 0, mejorables: 0 };
      
      // Crear contenedor de evaluación con contadores integrados
      const evaluacionDiv = document.createElement('div');
      evaluacionDiv.className = 'nota-evaluacion';
      
      // Usar la función del módulo si existe
      if (typeof crearBotonesConContadores === 'function') {
        evaluacionDiv.innerHTML = crearBotonesConContadores(notaId, version, evaluaciones);
      } else {
        // Fallback sin contadores
        evaluacionDiv.innerHTML = `
          <div class="evaluacion-header">
            <span>¿Te resulta útil esta nota?</span>
          </div>
          <div class="evaluacion-botones">
            <button class="btn btn-outline-success btn-evaluar btn-util" data-nota-id="${notaId}" data-version="${version}">
              <i class="fa-solid fa-heart" aria-hidden="true"></i> Útil
            </button>
            <button class="btn btn-outline-danger btn-evaluar btn-mejorable" data-nota-id="${notaId}" data-version="${version}">
              <i class="fa-solid fa-heart-crack" aria-hidden="true"></i> Mejorable
            </button>
          </div>
          <div class="evaluacion-comentario" style="display:none;">
            <textarea placeholder="¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota (opcional)" rows="3"></textarea>
            <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
            <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
          </div>
        `;
      }
      
      // Insertar antes del footer de la nota
      const noteFooter = noteContentDiv.querySelector('.note-footer');
      if (noteFooter) {
        noteFooter.parentNode.insertBefore(evaluacionDiv, noteFooter);
      } else {
        noteContentDiv.appendChild(evaluacionDiv);
      }
      
      // Adjuntar event listeners usando función reutilizable
      if (typeof attachEvaluationListeners === 'function') {
        attachEvaluationListeners(
          evaluacionDiv,
          notaId,
          version,
          (nId, ver, vote, comment) => this.registrarEvaluacion(nId, ver, vote, comment),
          (nId, vote) => this.mostrarFeedback(evaluacionDiv, vote, nId)
        );
      } else {
        // Fallback a método legacy
        this.attachButtonListeners(evaluacionDiv, notaId, version);
      }
    });
  }
  
  /**
   * Obtener versión de nota desde Supabase
   */
  async obtenerVersionNota(notaId) {
    try {
      const { data, error } = await window.supabaseClient
        .from('notas_activas')
        .select('version')
        .eq('nota_id', notaId)
        .single();
      
      if (error) {
        console.warn(`Nota ${notaId} no encontrada en Supabase`);
        return null;
      }
      
      return data.version;
    } catch (err) {
      console.error('Error al obtener versión de nota:', err);
      return null;
    }
  }
  
  /**
   * Adjuntar listeners a botones de evaluación (LEGACY - usar attachEvaluationListeners)
   * @deprecated Usar attachEvaluationListeners de evaluaciones-stats.js
   */
  attachButtonListeners(container, notaId, version) {
    const btnUtil = container.querySelector('.btn-util');
    const btnMejorable = container.querySelector('.btn-mejorable');
    const comentarioDiv = container.querySelector('.evaluacion-comentario');
    const textarea = comentarioDiv.querySelector('textarea');
    const btnEnviar = comentarioDiv.querySelector('.btn-enviar-comentario');
    const btnCancelar = comentarioDiv.querySelector('.btn-cancelar-comentario');
    
    // Botón "Útil"
    btnUtil.addEventListener('click', async () => {
      const exito = await this.registrarEvaluacion(notaId, version, 'up', null);
      if (exito) {
        // Actualizar contador local inmediatamente
        if (typeof actualizarContadorLocal === 'function') {
          actualizarContadorLocal(notaId, 'up');
        }
        this.mostrarFeedback(container, 'up', notaId);
      }
    });
    
    // Botón "Mejorable" - mostrar textarea
    btnMejorable.addEventListener('click', () => {
      comentarioDiv.style.display = 'block';
      textarea.focus();
    });
    
    // Botón "Enviar comentario"
    btnEnviar.addEventListener('click', async () => {
      const comentario = textarea.value.trim() || null;
      const exito = await this.registrarEvaluacion(notaId, version, 'down', comentario);
      if (exito) {
        // Actualizar contador local inmediatamente
        if (typeof actualizarContadorLocal === 'function') {
          actualizarContadorLocal(notaId, 'down');
        }
        this.mostrarFeedback(container, 'down', notaId);
      }
    });
    
    // Botón "Cancelar"
    btnCancelar.addEventListener('click', () => {
      comentarioDiv.style.display = 'none';
      textarea.value = '';
    });
  }
  
  /**
   * Registrar evaluación en Supabase
   */
  async registrarEvaluacion(notaId, version, vote, comentario) {
    // Verificar modo de usuario
    if (!window.userManager.tieneModoDefinido()) {
      await window.modalModo.mostrar();
    }
    
    const datosUsuario = window.userManager.obtenerDatosUsuario();
    
    if (!datosUsuario) {
      console.error('No se pudo obtener datos de usuario');
      mostrarToast('Error: modo no definido', 3000);
      return false;
    }
    
    // La sesión ya está creada en BD (se creó al elegir modo)
    const evaluacion = {
      timestamp: new Date().toISOString(),
      source: 'lectura',
      event_type: 'nota_eval',
      session_id: datosUsuario.session_id,
      pasaje_id: null, // En edición completa no hay pasaje específico
      nota_id: notaId,
      nota_version: version,
      vote: vote,
      comment: comentario
    };
    
    const { error } = await window.supabaseClient
      .from('evaluaciones')
      .insert(evaluacion);
    
    if (error) {
      console.error('Error al registrar evaluación:', error);
      mostrarToast('Error al enviar evaluación', 3000);
      return false;
    }
    
    // NO invalidamos caché aquí - actualizamos localmente en actualizarContadorLocal()
    
    console.log('Evaluación registrada:', vote, notaId);
    return true;
  }
  
  /**
   * Mostrar feedback visual tras evaluación
   */
  mostrarFeedback(container, vote, notaId) {
    const botones = container.querySelector('.evaluacion-botones');
    const comentario = container.querySelector('.evaluacion-comentario');
    
    // Ocultar botones y comentario
    botones.style.display = 'none';
    comentario.style.display = 'none';
    
    // Marcar como evaluada localmente
    this.notasEvaluadasLocal.add(notaId);
    
    // Crear mensaje de confirmación
    const feedback = document.createElement('div');
    feedback.className = 'nota-ya-evaluada';
    feedback.innerHTML = '<i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada';
    
    // Reemplazar el contenedor de evaluación
    container.replaceWith(feedback);
    
    // Toast adicional
    mostrarToast(vote === 'up' ? 'Nota marcada como útil' : 'Gracias por tu feedback', 2000);
  }
}

// Instanciar y exportar
window.edicionEvaluacion = new EdicionEvaluacion();

console.log('EdicionEvaluacion cargado');
