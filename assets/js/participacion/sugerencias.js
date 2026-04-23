import { mostrarToast } from '../lectura/utils.js';
import {
  getApiV2,
  getSessionData,
  getParticipationUserMessage
} from './evaluaciones.js';
// ============================================
// SISTEMA DE SUGERENCIAS DE NOTAS FALTANTES
// Permite a usuarios sugerir donde faltan notas
// ============================================

class SugerenciasNotas {
  constructor() {
    this.tooltip = null;
    this.modal = null;
    this.seleccionActual = null;
    this.source = this.detectarSource();
    this.isSubmitting = false;
    this.selectionReviewTimer = null;
    this.lastSelectionTarget = null;
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

  isNarrowLayout() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches;
  }

  usarTooltipAnclado() {
    return this.isNarrowLayout();
  }

  resolverTargetSeleccion(eventoOTarget) {
    if (eventoOTarget instanceof Element) {
      return eventoOTarget;
    }

    if (eventoOTarget && eventoOTarget.target instanceof Element) {
      return eventoOTarget.target;
    }

    return null;
  }

  programarRevisionSeleccion(eventoOTarget, delay = 20) {
    const target = this.resolverTargetSeleccion(eventoOTarget);
    if (target) {
      this.lastSelectionTarget = target;
    }

    if (this.selectionReviewTimer) {
      clearTimeout(this.selectionReviewTimer);
    }

    this.selectionReviewTimer = setTimeout(() => {
      this.manejarSeleccion(this.lastSelectionTarget);
    }, delay);
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

    // Listener del boton del tooltip
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
        <p class="modal-descripcion">\u00bfCrees que este texto necesita una nota explicativa? Cu\u00e9ntanos por qu\u00e9.</p>

        <div class="sugerencia-form">
          <label class="sugerencia-label">Texto seleccionado</label>
          <div class="sugerencia-texto-seleccionado" id="sugerencia-texto"></div>

          <label class="sugerencia-label" for="sugerencia-comentario">Tu comentario <span class="label-opcional">(opcional)</span></label>
          <textarea
            id="sugerencia-comentario"
            class="sugerencia-textarea"
            placeholder="\u00bfPor qu\u00e9 crees que falta una nota aqu\u00ed? \u00bfQu\u00e9 explicaci\u00f3n a\u00f1adir\u00edas?"
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
   * Configurar listeners de seleccion de texto
   */
  setupEventListeners() {
    // Detectar fin de seleccion de texto
    document.addEventListener('mouseup', (e) => {
      this.programarRevisionSeleccion(e, 10);
    });

    document.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      this.programarRevisionSeleccion(e, 30);
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      this.programarRevisionSeleccion(e, 40);
    }, { passive: true });

    document.addEventListener('selectionchange', () => {
      if (!this.usarTooltipAnclado()) return;
      this.programarRevisionSeleccion(this.lastSelectionTarget, 30);
    });

    // Cerrar tooltip al hacer clic fuera
    document.addEventListener('mousedown', (e) => {
      if (!this.tooltip.contains(e.target) && !e.target.closest('.sugerencia-modal')) {
        this.ocultarTooltip();
      }
    });

    document.addEventListener('pointerdown', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      if (!this.tooltip.contains(target) && !target.closest('.sugerencia-modal')) {
        this.ocultarTooltip();
      }
    }, { passive: true });

    // Cerrar tooltip al hacer scroll
    document.addEventListener('scroll', () => {
      this.ocultarTooltip();
    }, true);
  }

  /**
   * Manejar seleccion de texto
   */
  manejarSeleccion(e) {
    const selection = window.getSelection();
    if (!selection) return;

    const textoSeleccionado = selection.toString().trim();

    // No mostrar si no hay texto o es muy corto
    if (!textoSeleccionado || textoSeleccionado.length < 3) {
      this.ocultarTooltip();
      return;
    }

    if (selection.rangeCount === 0) {
      this.ocultarTooltip();
      return;
    }

    const targetElement = this.resolverTargetSeleccion(e);

    // No mostrar si el clic fue en el tooltip o modal
    if (
      targetElement &&
      (targetElement.closest('.sugerencia-tooltip') || targetElement.closest('.sugerencia-modal'))
    ) {
      return;
    }

    // Verificar que la seleccion esta dentro de la zona de edicion
    const zonaEdicion = this.obtenerZonaEdicion();
    if (!zonaEdicion) {
      this.ocultarTooltip();
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Verificar que el contenedor esta dentro de la zona de edicion
    const elementoContenedor = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : container;

    if (!(elementoContenedor instanceof Element) || !zonaEdicion.contains(elementoContenedor)) {
      this.ocultarTooltip();
      return;
    }

    // No mostrar si se selecciona dentro de una nota existente (note-wrapper)
    if (elementoContenedor.closest('.note-wrapper')) {
      this.ocultarTooltip();
      return;
    }

    // Guardar informacion de la seleccion
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
   * Obtener el xml:id del elemento TEI mas cercano
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

    // Intentar encontrar el verso o elemento TEI mas cercano
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
   * Mostrar el tooltip cerca de la seleccion
   */
  mostrarTooltip(rect) {
    const tooltip = this.tooltip;
    if (!tooltip) return;

    const usarAnclado = this.usarTooltipAnclado();
    tooltip.classList.toggle('is-anchored', usarAnclado);

    if (usarAnclado) {
      tooltip.style.top = '';
      tooltip.style.left = '50%';
      tooltip.style.display = 'block';
      return;
    }

    // Posicionar tooltip encima de la seleccion
    const tooltipHeight = 40;
    const gap = 8;

    let top = rect.top + window.scrollY - tooltipHeight - gap;
    let left = rect.left + window.scrollX + (rect.width / 2);

    // Ajustar si esta fuera de pantalla
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
    this.tooltip.classList.remove('is-anchored');
    this.tooltip.style.top = '';
    this.tooltip.style.left = '';
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
    // En laboratorio, el pasaje actual esta en window.laboratorioNotas
    if (window.laboratorioNotas && window.laboratorioNotas.pasajeActual) {
      return window.laboratorioNotas.pasajeActual.id;
    }

    if (window.editorSocial && window.editorSocial.pasajeActual) {
      return window.editorSocial.pasajeActual.id;
    }
    return null;
  }

  /**
   * Enviar la sugerencia a Supabase
   */
  async enviarSugerencia() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    if (!this.seleccionActual) {
      mostrarToast('Error: no hay texto seleccionado', 3000);
      this.isSubmitting = false;
      return;
    }

    const btnEnviar = this.modal.querySelector('.btn-enviar-sugerencia');
    const textoOriginal = btnEnviar.innerHTML;

    try {
      const flow = window.Participacion?.flow;
      if (flow?.ensureModeForSecondLecturaContribution) {
        const canContinue = await flow.ensureModeForSecondLecturaContribution();
        if (!canContinue) {
          mostrarToast('Para continuar debes elegir modo de participaci\u00f3n', 2600);
          return;
        }
      }

      const apiV2 = getApiV2();
      const sessionManager = window.Participacion?.session || null;
      if (sessionManager && typeof sessionManager.ensureSessionForWrite === 'function') {
        const ensured = await sessionManager.ensureSessionForWrite();
        if (!ensured || !ensured.ok) {
          const ensureMessage = getParticipationUserMessage(
            ensured && ensured.error,
            'session_bootstrap',
            'No se pudo preparar la sesion para enviar la sugerencia'
          );
          mostrarToast(ensureMessage || 'No se pudo preparar la sesion', 3000);
          return;
        }
      }

      const sessionData = getSessionData();

      if (!apiV2 || !sessionData?.session_id) {
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
        session_id: sessionData.session_id,
        pasaje_id: this.obtenerPasajeId(),
        target_xmlid: this.seleccionActual.xmlid,
        selected_text: this.seleccionActual.texto,
        comment: comentario
      };

      console.log('Enviando sugerencia:', sugerencia);

      const { error } = await apiV2.submitMissingNoteSuggestion(sugerencia);

      if (error) {
        throw error;
      }

      // Exito
      this.cerrarModal();
      mostrarToast('\u00a1Gracias por tu sugerencia!', 3000);
      console.log('Sugerencia de nota faltante registrada');
      if (flow?.incrementLecturaParticipationCount) {
        flow.incrementLecturaParticipationCount({ source: this.source || 'lectura' });
      }

    } catch (err) {
      console.error('Error al enviar sugerencia:', err);
      const message = getParticipationUserMessage(
        err,
        'sugerencia',
        'Error al enviar sugerencia'
      );
      mostrarToast(message || 'Error al enviar sugerencia', 3000);
    } finally {
      // Restaurar boton
      btnEnviar.innerHTML = textoOriginal;
      btnEnviar.disabled = false;
      this.isSubmitting = false;
    }
  }
}

// Instanciar y exportar
window.sugerenciasNotas = new SugerenciasNotas();

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', () => {
  // Pequeno delay para asegurar que otros scripts cargaron
  setTimeout(() => {
    window.sugerenciasNotas.init();
  }, 500);
});

console.log('SugerenciasNotas cargado');
