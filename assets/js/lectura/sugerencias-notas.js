// ============================================
// SISTEMA DE SUGERENCIAS DE NOTAS FALTANTES
// Permite a usuarios sugerir dónde faltan notas
// ============================================

class SugerenciasNotas {
  constructor() {
    this.tooltip = null;
    this.modal = null;
    this.seleccionActual = null;
    this.source = this.detectarSource();
  }

  /**
   * Detectar si estamos en sala de lectura o laboratorio
   */
  detectarSource() {
    if (window.location.pathname.includes('laboratorio')) {
      return 'laboratorio';
    }
    return 'lectura';
  }

  /**
   * Inicializar el sistema
   */
  init() {
    console.log('Inicializando sistema de sugerencias de notas...');
    this.crearTooltip();
    this.crearModal();
    this.setupEventListeners();
  }

  /**
   * Crear el tooltip flotante
   */
  crearTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sugerencia-tooltip';
    this.tooltip.innerHTML = `
      <button class="btn-sugerir-nota" type="button">
        <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
        Sugerir nota
      </button>
    `;
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);

    // Listener del botón del tooltip
    this.tooltip.querySelector('.btn-sugerir-nota').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.abrirModal();
    });
  }

  /**
   * Crear el modal de sugerencia
   */
  crearModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'modal sugerencia-modal';
    this.modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content sugerencia-modal-content">
        <button class="modal-close" type="button" aria-label="Cerrar">&times;</button>
        <h2><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> Sugerir nota</h2>
        <p class="modal-descripcion">¿Crees que este texto necesita una nota explicativa? Cuéntanos por qué.</p>
        
        <div class="sugerencia-form">
          <label class="sugerencia-label">Texto seleccionado</label>
          <div class="sugerencia-texto-seleccionado" id="sugerencia-texto"></div>
          
          <label class="sugerencia-label" for="sugerencia-comentario">Tu comentario <span class="label-opcional">(opcional)</span></label>
          <textarea 
            id="sugerencia-comentario" 
            class="sugerencia-textarea" 
            placeholder="¿Por qué crees que falta una nota aquí? ¿Qué explicación añadirías?"
            rows="4"
          ></textarea>
          
          <div class="sugerencia-botones">
            <button type="button" class="btn-cancelar-sugerencia btn btn-outline-dark">Cancelar</button>
            <button type="button" class="btn-enviar-sugerencia btn btn-dark">
              <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
              Enviar sugerencia
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Listeners del modal
    this.modal.querySelector('.modal-overlay').addEventListener('click', () => this.cerrarModal());
    this.modal.querySelector('.modal-close').addEventListener('click', () => this.cerrarModal());
    this.modal.querySelector('.btn-cancelar-sugerencia').addEventListener('click', () => this.cerrarModal());
    this.modal.querySelector('.btn-enviar-sugerencia').addEventListener('click', () => this.enviarSugerencia());

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('show')) {
        this.cerrarModal();
      }
    });
  }

  /**
   * Configurar listeners de selección de texto
   */
  setupEventListeners() {
    // Detectar fin de selección de texto
    document.addEventListener('mouseup', (e) => {
      // Pequeño delay para que la selección se complete
      setTimeout(() => this.manejarSeleccion(e), 10);
    });

    // Cerrar tooltip al hacer clic fuera
    document.addEventListener('mousedown', (e) => {
      if (!this.tooltip.contains(e.target) && !e.target.closest('.sugerencia-modal')) {
        this.ocultarTooltip();
      }
    });

    // Cerrar tooltip al hacer scroll
    document.addEventListener('scroll', () => {
      this.ocultarTooltip();
    }, true);
  }

  /**
   * Manejar selección de texto
   */
  manejarSeleccion(e) {
    const selection = window.getSelection();
    const textoSeleccionado = selection.toString().trim();

    // No mostrar si no hay texto o es muy corto
    if (!textoSeleccionado || textoSeleccionado.length < 3) {
      return;
    }

    // No mostrar si el clic fue en el tooltip o modal
    if (e.target.closest('.sugerencia-tooltip') || e.target.closest('.sugerencia-modal')) {
      return;
    }

    // Verificar que la selección está dentro de la zona de edición
    const zonaEdicion = this.obtenerZonaEdicion();
    if (!zonaEdicion) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Verificar que el contenedor está dentro de la zona de edición
    const elementoContenedor = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container;
    
    if (!zonaEdicion.contains(elementoContenedor)) {
      return;
    }

    // No mostrar si se selecciona dentro de una nota existente (note-wrapper)
    if (elementoContenedor.closest('.note-wrapper')) {
      return;
    }

    // Guardar información de la selección
    this.seleccionActual = {
      texto: textoSeleccionado,
      range: range.cloneRange(),
      xmlid: this.obtenerXmlIdCercano(elementoContenedor),
      rect: range.getBoundingClientRect()
    };

    // Mostrar tooltip
    this.mostrarTooltip(this.seleccionActual.rect);
  }

  /**
   * Obtener la zona donde se puede seleccionar texto
   */
  obtenerZonaEdicion() {
    // Sala de lectura: columna de texto
    const textColumn = document.querySelector('.text-column');
    if (textColumn) return textColumn;

    // Laboratorio: contenedor del pasaje
    const pasajeContainer = document.querySelector('.pasaje-container');
    if (pasajeContainer) return pasajeContainer;

    return null;
  }

  /**
   * Obtener el xml:id del elemento TEI más cercano
   */
  obtenerXmlIdCercano(elemento) {
    // Buscar hacia arriba el primer elemento con xml:id
    let current = elemento;
    while (current && current !== document.body) {
      // TEI elements tienen xml:id como atributo
      const xmlId = current.getAttribute('xml:id') || 
                    current.getAttribute('data-xmlid') ||
                    current.id;
      if (xmlId) {
        return xmlId;
      }
      current = current.parentElement;
    }

    // Intentar encontrar el verso o elemento TEI más cercano
    const teiElement = elemento.closest('tei-l, tei-sp, tei-stage, tei-p, tei-seg');
    if (teiElement) {
      return teiElement.getAttribute('xml:id') || 
             teiElement.getAttribute('data-xmlid') || 
             teiElement.id || 
             null;
    }

    return null;
  }

  /**
   * Mostrar el tooltip cerca de la selección
   */
  mostrarTooltip(rect) {
    const tooltip = this.tooltip;
    
    // Posicionar tooltip encima de la selección
    const tooltipHeight = 40;
    const gap = 8;
    
    let top = rect.top + window.scrollY - tooltipHeight - gap;
    let left = rect.left + window.scrollX + (rect.width / 2);

    // Ajustar si está fuera de pantalla
    if (top < window.scrollY + 10) {
      top = rect.bottom + window.scrollY + gap;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.display = 'block';
  }

  /**
   * Ocultar el tooltip
   */
  ocultarTooltip() {
    this.tooltip.style.display = 'none';
  }

  /**
   * Abrir el modal de sugerencia
   */
  abrirModal() {
    if (!this.seleccionActual) return;

    // Llenar el texto seleccionado
    const textoDiv = this.modal.querySelector('#sugerencia-texto');
    textoDiv.textContent = this.seleccionActual.texto;

    // Limpiar comentario anterior
    this.modal.querySelector('#sugerencia-comentario').value = '';

    // Mostrar modal
    this.modal.classList.add('show');
    this.ocultarTooltip();

    // Focus en textarea
    setTimeout(() => {
      this.modal.querySelector('#sugerencia-comentario').focus();
    }, 100);
  }

  /**
   * Cerrar el modal
   */
  cerrarModal() {
    this.modal.classList.remove('show');
    this.seleccionActual = null;
  }

  /**
   * Obtener el pasaje_id actual (si estamos en laboratorio)
   */
  obtenerPasajeId() {
    // En laboratorio, el pasaje actual está en window.laboratorioNotas
    if (window.laboratorioNotas && window.laboratorioNotas.pasajeActual) {
      return window.laboratorioNotas.pasajeActual.id;
    }
    return null;
  }

  /**
   * Enviar la sugerencia a Supabase
   */
  async enviarSugerencia() {
    if (!this.seleccionActual) {
      mostrarToast('Error: no hay texto seleccionado', 3000);
      return;
    }

    const btnEnviar = this.modal.querySelector('.btn-enviar-sugerencia');
    const textoOriginal = btnEnviar.innerHTML;
    
    try {
      // Verificar modo de usuario
      if (!window.userManager.tieneModoDefinido()) {
        await window.modalModo.mostrar();
      }

      const datosUsuario = window.userManager.obtenerDatosUsuario();
      
      if (!datosUsuario) {
        mostrarToast('Error: modo no definido', 3000);
        return;
      }

      // Mostrar estado de carga
      btnEnviar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
      btnEnviar.disabled = true;

      // Preparar datos
      const comentario = this.modal.querySelector('#sugerencia-comentario').value.trim() || null;
      
      const sugerencia = {
        source: this.source,
        session_id: datosUsuario.session_id,
        pasaje_id: this.obtenerPasajeId(),
        target_xmlid: this.seleccionActual.xmlid,
        selected_text: this.seleccionActual.texto,
        comment: comentario
      };

      console.log('Enviando sugerencia:', sugerencia);

      const { error } = await window.SupabaseAPI.submitMissingNoteSuggestion(sugerencia);

      if (error) {
        throw error;
      }

      // Éxito
      this.cerrarModal();
      mostrarToast('¡Gracias por tu sugerencia!', 3000);
      console.log('Sugerencia de nota faltante registrada');

    } catch (err) {
      console.error('Error al enviar sugerencia:', err);
      mostrarToast('Error al enviar sugerencia', 3000);
    } finally {
      // Restaurar botón
      btnEnviar.innerHTML = textoOriginal;
      btnEnviar.disabled = false;
    }
  }
}

// Instanciar y exportar
window.sugerenciasNotas = new SugerenciasNotas();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Pequeño delay para asegurar que otros scripts cargaron
  setTimeout(() => {
    window.sugerenciasNotas.init();
  }, 500);
});

console.log('SugerenciasNotas cargado');
