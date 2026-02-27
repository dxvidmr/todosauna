import {
  mostrarToast,
  cargarXMLCacheado,
  alignSplitVerses,
  aplicarNumeracionVersos
} from './utils.js';
import { extraerFragmento, extraerXmlIdsDelFragmento } from './pasajes.js';
import { cargarNotasActivas } from './notas.js';
import {
  obtenerEvaluacionesStats,
  attachEvaluationListeners,
  actualizarContadorLocal,
  obtenerEstadisticasGlobales,
  renderizarEstadisticasGlobales
} from './evaluaciones-stats.js';

// ============================================
// EDITOR SOCIAL (JUEGO DE EVALUACION)
// Sistema de notas con navegacion lateral
// Actualizado con modos de navegación
// ============================================

class EditorSocial {
  constructor() {
    this.pasajeActualIndex = 0;
    this.pasajes = [];
    this.xmlDoc = null;
    
    // Estado de notas del pasaje actual
    this.notasPasaje = [];
    this.notaActualIndex = -1;
    this.notasEvaluadas = new Set();
    
    // Modo de navegación: 'secuencial' | 'aleatorio'
    this.modoNavegacion = null;
    
    // Tracking de pasajes visitados en modo aleatorio (para no repetir en sesión)
    this.pasajesVisitados = new Set();
    
    // Referencias DOM
    this.pasajeContent = null;
    this.notaContent = null;
    this.bienvenidaContainer = null;
    this.laboratorioLayout = null;
    this.wrapperEl = null;
    this.navWrapper = null;

    // Zoom del pasaje (sesion actual)
    this.labFontSizePercent = 100;
    this.labFontMin = 80;
    this.labFontMax = 150;
    this.labFontStep = 5;
    this.labFontVisualScale = 0.9;
    this.resizeAdjustTimer = null;
    this.pendingEvaluations = new Set();
  }

  notifyFeedback(message, type, duration) {
    var text = String(message || '').trim();
    if (!text) return;

    if (window.Participacion?.ui?.notify) {
      window.Participacion.ui.notify({
        message: text,
        type: type || 'info',
        duration: duration || 2500
      });
      return;
    }

    if (typeof mostrarToast === 'function') {
      mostrarToast(text, duration || 2500);
      return;
    }

    console.log(text);
  }

  async confirmFeedback(options) {
    if (window.Participacion?.ui?.['confirm']) {
      return window.Participacion.ui['confirm'](options || {});
    }
    return false;
  }

  getApiV2() {
    return window.Participacion?.apiV2 || null;
  }

  getSessionData() {
    return window.Participacion?.session?.getPublicSessionData?.() || null;
  }

  isModeDefined() {
    return !!window.Participacion?.session?.isModeDefined?.();
  }

  async openParticipationModal(options) {
    if (!window.Participacion?.modal?.open) return;
    await window.Participacion.modal.open(options || {});
  }

  getParticipationUserMessage(error, context, fallback) {
    const api = this.getApiV2();
    if (api && typeof api.getParticipationUserMessage === 'function') {
      return api.getParticipationUserMessage(error, context, fallback);
    }

    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback;
    }

    if (error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    return 'Error inesperado';
  }

  setNoteEvaluationBusy(notaId, isBusy) {
    var key = String(notaId || '');
    if (!key) return;

    this.notaContent
      ?.querySelectorAll('.nota-evaluacion')
      .forEach((block) => {
        if (String(block.dataset.noteId || '') !== key) return;
        block.querySelectorAll('button').forEach((btn) => {
          btn.disabled = !!isBusy;
        });
        block.querySelectorAll('textarea').forEach((area) => {
          area.readOnly = !!isBusy;
        });
      });
  }

  /**
   * Carga dinamica de CETEI.js si no esta disponible.
   */
  async asegurarCETEI() {
    if (typeof window.CETEI !== 'undefined') return true;

    if (window.__ceteiLoadingPromise) {
      await window.__ceteiLoadingPromise;
      return typeof window.CETEI !== 'undefined';
    }

    window.__ceteiLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Usar rutas de Jekyll si están disponibles, sino ruta relativa
      const jsPath = window.SITE_PATHS?.js || '../assets/js/lectura';
      script.src = jsPath + '/CETEI.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar CETEI.js'));
      document.head.appendChild(script);
    });

    try {
      await window.__ceteiLoadingPromise;
      return typeof window.CETEI !== 'undefined';
    } finally {
      window.__ceteiLoadingPromise = null;
    }
  }

  /**
   * Inicializar editor social
   */
  async init() {
    console.log('Inicializando Editor Social...');

    // Referencias DOM
    this.pasajeContent = document.getElementById('pasaje-content');
    this.notaContent = document.getElementById('nota-content');
    this.bienvenidaContainer = document.getElementById('laboratorio-bienvenida');
    this.laboratorioLayout = document.querySelector('.laboratorio-layout');
    this.wrapperEl = document.querySelector('.laboratorio-wrapper');
    this.navWrapper = document.querySelector('.nav-wrapper');
    this.modalCambiarModo = document.getElementById('modal-cambiar-modo');

    // Cargar pasajes desde Supabase
    await this.cargarPasajes();

    // Cargar XML de Fuenteovejuna (se cachea)
    const xmlPath = window.SITE_PATHS?.xml || '../assets/xml';
    this.xmlDoc = await cargarXMLCacheado(xmlPath + '/fuenteovejuna.xml');

    // Asegurar CETEI antes de renderizar
    const okCetei = await this.asegurarCETEI();
    if (!okCetei) {
      throw new Error('CETEI.js no esta cargado y no se pudo cargar dinamicamente.');
    }

    // Cargar estadísticas globales
    await this.cargarEstadisticasGlobales();

    // Mostrar pantalla de bienvenida
    this.mostrarPantallaBienvenida();

    // Event listeners para pantalla de bienvenida
    this.setupBienvenidaListeners();
    
    // Event listeners para controles del laboratorio
    this.setupEventListeners();
    this.actualizarDisplayZoomPasaje();

    console.log('Editor Social inicializado');
  }

  /**
   * Cargar estadísticas globales
   */
  async cargarEstadisticasGlobales() {
    const container = document.querySelector('.stats-globales');
    
    if (!container) {
      console.warn('Contenedor de estadísticas no encontrado');
      return;
    }

    try {
      // Usar la función del módulo evaluaciones-stats
      if (typeof obtenerEstadisticasGlobales === 'function') {
        const stats = await obtenerEstadisticasGlobales();
        
        // Renderizar con la función del módulo
        if (typeof renderizarEstadisticasGlobales === 'function') {
          renderizarEstadisticasGlobales(container, stats);
        }
      } else {
        throw new Error('Función obtenerEstadisticasGlobales no disponible');
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      container.innerHTML = `
        <div class="stats-header">
          <i class="fa-solid fa-chart-bar" aria-hidden="true"></i>
          <strong>Estadísticas globales</strong>
        </div>
        <p class="stats-error">No disponible</p>
      `;
    }
  }

  /**
   * Aplicar estado visual global del laboratorio.
   * view: 'welcome' | 'mode'
   */
  aplicarEstadoVista(view) {
    const isMode = view === 'mode';

    if (this.wrapperEl) {
      this.wrapperEl.setAttribute('data-laboratorio-view', view);
    }

    document.body.classList.toggle('laboratorio-mode-active', isMode);
    document.body.classList.toggle('laboratorio-welcome-active', !isMode);

    if (this.navWrapper) {
      this.navWrapper.setAttribute('data-navbar-variant', isMode ? 'compact' : 'default');
      this.navWrapper.classList.remove('visible');
    }

    if (window.NavbarBehavior?.closeMenu) {
      window.NavbarBehavior.closeMenu();
    }

    if (window.NavbarBehavior?.showNavbar) {
      window.NavbarBehavior.showNavbar();
    }
  }

  getTeiPasajeContainer() {
    return document.getElementById('tei-pasaje');
  }

  actualizarDisplayZoomPasaje() {
    const display = document.getElementById('lab-font-size-display');
    if (display) {
      display.textContent = `${this.labFontSizePercent}%`;
    }
  }

  aplicarZoomPasaje(percent) {
    const teiContainer = this.getTeiPasajeContainer();
    const clampedPercent = Math.max(this.labFontMin, Math.min(this.labFontMax, percent));
    const effectivePercent = clampedPercent * this.labFontVisualScale;
    this.labFontSizePercent = clampedPercent;

    if (teiContainer) {
      teiContainer.style.setProperty('--lab-pasaje-font-size', `${effectivePercent}%`);
    }

    this.actualizarDisplayZoomPasaje();
  }

  tieneOverflowHorizontalPasaje() {
    const pasajeContainer = document.querySelector('.pasaje-container');
    const teiContainer = this.getTeiPasajeContainer();

    if (!pasajeContainer || !teiContainer) return false;

    return (
      teiContainer.scrollWidth > teiContainer.clientWidth + 1 ||
      pasajeContainer.scrollWidth > pasajeContainer.clientWidth + 1
    );
  }

  ajustarZoomHastaNoOverflow() {
    let safety = 0;
    while (this.tieneOverflowHorizontalPasaje() && this.labFontSizePercent > this.labFontMin && safety < 40) {
      this.aplicarZoomPasaje(this.labFontSizePercent - this.labFontStep);
      safety += 1;
    }
  }

  intentarAumentarZoomSinOverflow() {
    if (this.labFontSizePercent >= this.labFontMax) {
      mostrarToast('Tamaño máximo alcanzado', 1400);
      return;
    }

    const previous = this.labFontSizePercent;
    this.aplicarZoomPasaje(previous + this.labFontStep);

    if (this.tieneOverflowHorizontalPasaje()) {
      this.aplicarZoomPasaje(previous);
      mostrarToast('No se puede aumentar más sin desbordar', 1600);
    }
  }

  /**
   * Mostrar pantalla de bienvenida
   */
  mostrarPantallaBienvenida() {
    this.aplicarEstadoVista('welcome');

    if (this.bienvenidaContainer) {
      this.bienvenidaContainer.style.display = 'flex';
    }
    if (this.laboratorioLayout) {
      this.laboratorioLayout.classList.remove('active');
    }
  }

  /**
   * Ocultar pantalla de bienvenida y mostrar laboratorio
   */
  ocultarPantallaBienvenida() {
    this.aplicarEstadoVista('mode');

    if (this.bienvenidaContainer) {
      this.bienvenidaContainer.style.display = 'none';
    }
    if (this.laboratorioLayout) {
      this.laboratorioLayout.classList.add('active');
    }
  }

  async asegurarModoAntesDeIniciarLaboratorio() {
    if (this.isModeDefined()) return true;

    await this.openParticipationModal({
      context: 'laboratorio-before-mode',
      reason: 'before-start'
    });

    return this.isModeDefined();
  }

  async iniciarModoDesdeBienvenida(modo) {
    if (modo !== 'secuencial' && modo !== 'aleatorio') return;

    const canStart = await this.asegurarModoAntesDeIniciarLaboratorio();
    if (!canStart) {
      mostrarToast('Para empezar debes elegir modo de participación', 2600);
      return;
    }

    if (modo === 'secuencial') {
      await this.iniciarModoSecuencial();
      return;
    }

    await this.iniciarModoAleatorio();
  }

  /**
   * Setup listeners para botones de modo
   */
  setupBienvenidaListeners() {
    const opcionesModo = document.querySelectorAll('.opcion-modo');
    
    opcionesModo.forEach(opcion => {
      opcion.addEventListener('click', () => {
        const modo = opcion.dataset.modo;
        void this.iniciarModoDesdeBienvenida(modo);
      });
      
      // Accesibilidad: permitir Enter y Space para activar
      opcion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const modo = opcion.dataset.modo;
          void this.iniciarModoDesdeBienvenida(modo);
        }
      });
    });
  }

  /**
   * Iniciar modo secuencial
   */
  async iniciarModoSecuencial() {
    this.modoNavegacion = 'secuencial';
    this.pasajesVisitados.clear();
    this.ocultarPantallaBienvenida();
    this.actualizarModoControlesFranja('secuencial');
    
    // Actualizar badge de modo
    const badgeElement = document.getElementById('modo-actual-badge');
    if (badgeElement) {
      badgeElement.textContent = 'Secuencial';
    }
    
    // Mostrar barra de progreso
    const barraContainer = document.getElementById('barra-progreso-container');
    if (barraContainer) {
      barraContainer.style.display = 'block';
    }
    
    // Mostrar botón anterior
    const btnAnterior = document.getElementById('btn-anterior');
    if (btnAnterior) {
      btnAnterior.style.display = 'inline-flex';
    }    
    // Cargar primer pasaje
    await this.cargarPasaje(0);
  }

  /**
   * Iniciar modo aleatorio
   */
  async iniciarModoAleatorio() {
    this.modoNavegacion = 'aleatorio';
    this.pasajesVisitados.clear();
    this.ocultarPantallaBienvenida();
    this.actualizarModoControlesFranja('aleatorio');
    
    // Actualizar badge de modo
    const badgeElement = document.getElementById('modo-actual-badge');
    if (badgeElement) {
      badgeElement.textContent = 'Aleatorio';
    }
    
    // Ocultar barra de progreso
    const barraContainer = document.getElementById('barra-progreso-container');
    if (barraContainer) {
      barraContainer.style.display = 'none';
    }
    
    // Ocultar botón anterior
    const btnAnterior = document.getElementById('btn-anterior');
    if (btnAnterior) {
      btnAnterior.style.display = 'none';
    }    
    // Cargar pasaje aleatorio
    await this.cargarPasajeAleatorio();
  }

  /**
   * Cargar un pasaje aleatorio no visitado
   */
  async cargarPasajeAleatorio() {
    // Obtener pasajes no visitados
    const pasajesDisponibles = this.pasajes.filter((_, index) => 
      !this.pasajesVisitados.has(index)
    );

    if (pasajesDisponibles.length === 0) {
      // Todos visitados - resetear o mostrar finalización
      const shouldRestart = await this.confirmFeedback({
        title: 'Has visitado todos los pasajes',
        message: '¿Quieres volver a empezar?',
        confirmText: 'Sí, volver a empezar',
        cancelText: 'Cerrar',
        variant: 'warning'
      });

      if (shouldRestart) {
        this.pasajesVisitados.clear();
        await this.cargarPasajeAleatorio();
      } else {
        this.mostrarFinalizacion();
      }
      return;
    }

    // Elegir pasaje aleatorio
    const pasajeAleatorio = pasajesDisponibles[
      Math.floor(Math.random() * pasajesDisponibles.length)
    ];
    
    const indexAleatorio = this.pasajes.indexOf(pasajeAleatorio);
    await this.cargarPasaje(indexAleatorio);
  }

  /**
   * Actualizar barra de progreso (solo modo secuencial)
   */
  actualizarBarraProgreso() {
    if (this.modoNavegacion !== 'secuencial') return;

    const barraFill = document.getElementById('barra-progreso-fill');
    if (barraFill && this.pasajes.length > 0) {
      const progreso = ((this.pasajeActualIndex + 1) / this.pasajes.length) * 100;
      barraFill.style.width = `${progreso}%`;
    }
  }

  /**
   * Actualizar barra de progreso de notas
   * Usa el estado interno (notas evaluadas / total) para el porcentaje
   */
  actualizarBarraProgresoNotas() {
    const barraFill = document.getElementById('barra-progreso-notas-fill');
    if (!barraFill) return;

    const total = Math.max(1, this.notasPasaje.length);
    const evaluadas = this.notasEvaluadas ? this.notasEvaluadas.size : (parseInt(document.getElementById('notas-evaluadas')?.textContent) || 0);

    const porcentaje = (evaluadas / total) * 100;
    barraFill.style.width = `${porcentaje}%`;

    // Mantener consistencia visual: también actualizar valor del span si es necesario
    const notasEvaluadasSpan = document.getElementById('notas-evaluadas');
    const notasTotalesSpan = document.getElementById('notas-totales');
    if (notasEvaluadasSpan) notasEvaluadasSpan.textContent = evaluadas;
    if (notasTotalesSpan) notasTotalesSpan.textContent = this.notasPasaje.length;
  }

  /**
   * Cargar lista de pasajes desde Supabase
   */
  async cargarPasajes() {
    const apiV2 = this.getApiV2();
    if (!apiV2 || typeof apiV2.getPasajes !== 'function') {
      this.notifyFeedback('Error al cargar pasajes. API no disponible.', 'error', 3200);
      return;
    }
    const { data, error } = await apiV2.getPasajes();

    if (error) {
      console.error('Error al cargar pasajes:', error);
      this.notifyFeedback('Error al cargar pasajes. Verifica tu conexión.', 'error', 3200);
      return;
    }

    this.pasajes = data ?? [];
    document.getElementById('pasajes-totales').textContent = this.pasajes.length;
    console.log(`${this.pasajes.length} pasajes cargados`);
  }

  /**
   * Cargar un pasaje especifico
   */
  async cargarPasaje(index) {
    if (index < 0 || index >= this.pasajes.length) {
      console.log('Fin de pasajes alcanzado');
      this.mostrarFinalizacion();
      return;
    }

    this.pasajeActualIndex = index;
    
    // Marcar como visitado (para modo aleatorio)
    this.pasajesVisitados.add(index);
    
    // Reset estado de notas
    this.notasPasaje = [];
    this.notaActualIndex = -1;
    this.notasEvaluadas.clear();

    const pasaje = this.pasajes[index];

    // Actualizar UI
    document.getElementById('pasaje-actual').textContent = index + 1;
    
    // Actualizar barra de progreso (solo modo secuencial)
    this.actualizarBarraProgreso();
    
    // Actualizar botones de navegación
    this.actualizarBotonesNavegacionPasajes();

    // Extraer fragmento del XML
    const fragmento = extraerFragmento(this.xmlDoc, pasaje);

    if (!fragmento) {
      console.error('No se pudo extraer el fragmento');
      return;
    }

    // Renderizar con CETEI
    await this.renderizarPasaje(fragmento, pasaje);

    // Cargar notas y aplicar highlights
    await this.cargarYAplicarNotas(fragmento, pasaje);

    // Actualizar barra de progreso de notas
    this.actualizarBarraProgresoNotas();
  }

  /**
   * Renderizar pasaje con CETEI
   */
  async renderizarPasaje(fragmento, pasaje) {
    this.pasajeContent.innerHTML = '';

    // Anadir titulo del pasaje
    const titulo = document.createElement('h2');
    titulo.className = 'lab-pasaje-titulo';
    titulo.textContent = pasaje.titulo;
    this.pasajeContent.appendChild(titulo);

    // Anadir descripcion si existe
    if (pasaje.descripcion) {
      const descripcion = document.createElement('p');
      descripcion.className = 'lab-pasaje-descripcion';
      descripcion.textContent = pasaje.descripcion;
      this.pasajeContent.appendChild(descripcion);
    }

    // Asegurar CETEI
    const okCetei = await this.asegurarCETEI();
    if (!okCetei || typeof window.CETEI === 'undefined') {
      throw new Error('CETEI.js no esta cargado.');
    }

    // Crear documento temporal para CETEI
    const xmlStr = new XMLSerializer().serializeToString(fragmento);
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(xmlStr, 'text/xml');

    // Renderizar XML con CETEI
    const cetei = new window.CETEI();
    const htmlContent = cetei.domToHTML5(tempDoc);

    // Crear contenedor para el contenido TEI
    const teiContainer = document.createElement('div');
    teiContainer.id = 'tei-pasaje';
    teiContainer.className = 'lab-tei-pasaje';
    teiContainer.appendChild(htmlContent);

    this.pasajeContent.appendChild(teiContainer);

    // Aplicar alineacion de versos partidos y numeración de versos
    setTimeout(() => {
      alignSplitVerses(teiContainer);
      aplicarNumeracionVersos(teiContainer, 'cada5');
      this.aplicarZoomPasaje(this.labFontSizePercent);
      this.ajustarZoomHastaNoOverflow();
    }, 100);

    console.log('Pasaje renderizado:', pasaje.titulo);
  }

  /**
   * Cargar notas del pasaje y aplicar highlights al texto
   */
  async cargarYAplicarNotas(fragmento, pasaje) {
    // Obtener xml:ids del fragmento
    const xmlIds = extraerXmlIdsDelFragmento(fragmento);

    // Cargar todas las notas activas
    const todasNotas = await cargarNotasActivas();

    // Filtrar notas que aplican a este pasaje
    this.notasPasaje = filtrarNotasPorXmlIds(todasNotas, xmlIds);

    console.log(`${this.notasPasaje.length} notas para el pasaje ${pasaje.titulo}`);

    // Actualizar contadores
    this.actualizarContadores();

    // Aplicar highlights al texto
    this.aplicarHighlights();

    // Mostrar placeholder o primera nota
    if (this.notasPasaje.length === 0) {
      this.renderizarEstadoNotaPanel(
        'No hay notas en este pasaje',
        'Sin evaluaciones disponibles en este pasaje'
      );
    } else {
      this.renderizarEstadoNotaPanel(
        '',
        ''
      );
    }
  }

  renderizarEstadoNotaPanel(mensajeContenido, mensajeDock) {
    if (!this.notaContent) return;

    const displayHtml = mensajeContenido
      ? `<p class="placeholder-text">${mensajeContenido}</p>`
      : '';
    const dockHtml = mensajeDock
      ? `<p class="lab-note-dock-placeholder">${mensajeDock}</p>`
      : '';

    this.notaContent.innerHTML = `
      <div class="lab-note-layout">
        <div class="lab-note-display-scroll">
          ${displayHtml}
        </div>
        <div class="lab-note-eval-dock">
          ${dockHtml}
        </div>
      </div>
    `;
  }

  /**
   * Aplicar highlights al texto basandose en las notas de Supabase
   */
  aplicarHighlights() {
    const teiContainer = document.getElementById('tei-pasaje');
    if (!teiContainer) return;

    // Ordenar notas: primero las mas especificas (seg), luego las generales (l)
    const notasOrdenadas = [...this.notasPasaje].sort((a, b) => {
      const targetA = a.target || '';
      const targetB = b.target || '';
      
      const aIsSeg = targetA.includes('seg-');
      const bIsSeg = targetB.includes('seg-');
      
      if (aIsSeg && !bIsSeg) return -1;
      if (!aIsSeg && bIsSeg) return 1;
      
      const aCount = targetA.split(/\s+/).length;
      const bCount = targetB.split(/\s+/).length;
      return aCount - bCount;
    });

    notasOrdenadas.forEach((nota, index) => {
      const targetAttr = nota.target;
      const notaId = nota.nota_id;
      
      if (!targetAttr || !notaId) return;

      const targets = targetAttr.split(/\s+/).map(t => t.replace('#', ''));
      const targetElements = [];

      // Buscar todos los elementos target en el DOM
      targets.forEach(targetId => {
        let element = teiContainer.querySelector(`[xml\\:id="${targetId}"]`);
        
        if (!element) {
          const allElements = teiContainer.querySelectorAll('*');
          for (let el of allElements) {
            if (el.getAttribute('xml:id') === targetId) {
              element = el;
              break;
            }
          }
        }
        
        if (element) {
          targetElements.push(element);
        }
      });

      if (targetElements.length === 0) return;

      // Aplicar wrapper a cada elemento target
      targetElements.forEach(element => {
        let wrapperElement = null;
        
        // Verificar si ya existe un wrapper
        if (element.firstElementChild && element.firstElementChild.classList.contains('note-wrapper')) {
          wrapperElement = element.firstElementChild;
        } else {
          // Crear wrapper nuevo
          wrapperElement = document.createElement('span');
          wrapperElement.className = 'note-wrapper note-target';
          
          // Mover contenido al wrapper
          const childNodes = Array.from(element.childNodes);
          childNodes.forEach(child => {
            wrapperElement.appendChild(child);
          });
          
          element.appendChild(wrapperElement);
        }
        
        // Asegurar clases
        if (!wrapperElement.classList.contains('note-target')) {
          wrapperElement.classList.add('note-target');
        }
        
        // Anadir ID de nota y su indice
        const currentGroups = wrapperElement.getAttribute('data-note-groups') || '';
        const groups = currentGroups ? currentGroups.split(' ').filter(g => g) : [];
        if (!groups.includes(notaId)) {
          groups.push(notaId);
          wrapperElement.setAttribute('data-note-groups', groups.join(' '));
        }

        // Anadir eventos solo una vez por wrapper
        if (!wrapperElement.hasAttribute('data-note-events')) {
          wrapperElement.setAttribute('data-note-events', 'true');
          
          // Evento click - mostrar nota correspondiente
          wrapperElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const noteGroups = wrapperElement.getAttribute('data-note-groups');
            if (!noteGroups) return;
            
            const firstNoteId = noteGroups.split(' ')[0];
            const noteIndex = this.notasPasaje.findIndex(n => n.nota_id === firstNoteId);
            
            if (noteIndex >= 0) {
              this.navegarANota(noteIndex);
            }
          });

          // Evento mouseenter - highlight
          wrapperElement.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            const noteGroups = wrapperElement.getAttribute('data-note-groups');
            if (noteGroups) {
              this.highlightNotaEnTexto(noteGroups.split(' ')[0], true);
            }
          });

          // Evento mouseleave - quitar highlight
          wrapperElement.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            const noteGroups = wrapperElement.getAttribute('data-note-groups');
            if (noteGroups) {
              const noteId = noteGroups.split(' ')[0];
              const notaActual = this.notasPasaje[this.notaActualIndex];
              if (!notaActual || notaActual.nota_id !== noteId) {
                this.highlightNotaEnTexto(noteId, false);
              }
            }
          });
        }
      });
    });

    aplicarNumeracionVersos(teiContainer, 'cada5');
    this.ajustarZoomHastaNoOverflow();

    console.log('Highlights aplicados');
  }

  /**
   * Highlight/unhighlight una nota en el texto
   */
  highlightNotaEnTexto(notaId, activo) {
    const teiContainer = document.getElementById('tei-pasaje');
    if (!teiContainer) return;

    const wrappers = teiContainer.querySelectorAll(`[data-note-groups*="${notaId}"]`);
    wrappers.forEach(wrapper => {
      if (activo) {
        wrapper.classList.add('note-active');
      } else {
        wrapper.classList.remove('note-active');
      }
    });
  }

  /**
   * Marcar nota actual en el texto
   */
  marcarNotaActualEnTexto(notaId) {
    const teiContainer = document.getElementById('tei-pasaje');
    if (!teiContainer) return;

    // Quitar marca anterior
    teiContainer.querySelectorAll('.note-current').forEach(el => {
      el.classList.remove('note-current');
    });

    // Quitar todos los active
    teiContainer.querySelectorAll('.note-active').forEach(el => {
      el.classList.remove('note-active');
    });

    // Marcar la actual
    if (notaId) {
      const wrappers = teiContainer.querySelectorAll(`[data-note-groups*="${notaId}"]`);
      wrappers.forEach(wrapper => {
        wrapper.classList.add('note-current', 'note-active');
      });

      // Scroll al primer elemento
      if (wrappers.length > 0) {
        wrappers[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  /**
   * Navegar a una nota especifica por indice
   */
  navegarANota(index) {
    if (index < 0 || index >= this.notasPasaje.length) return;

    this.notaActualIndex = index;
    const nota = this.notasPasaje[index];

    // Actualizar indicador de posicion
    document.getElementById('nota-actual-index').textContent = index + 1;

    // Marcar en el texto
    this.marcarNotaActualEnTexto(nota.nota_id);

    // Actualizar botones de navegacion
    this.actualizarBotonesNavegacion();

    // Renderizar la nota
    this.renderizarNotaActual(nota);

    // Actualizar barra de progreso de notas
    this.actualizarBarraProgresoNotas();
  }

  /**
   * Renderizar la nota actual en el panel lateral
   */
  renderizarNotaActual(nota) {
    const pasajeId = this.pasajes[this.pasajeActualIndex]?.id;
    const yaEvaluada = this.notasEvaluadas.has(nota.nota_id);

    // Mapeo de tipologias normalizadas (igual que sala de lectura)
    const typeMap = {
      lexica: 'léxica',
      parafrasis: 'paráfrasis',
      historica: 'histórica',
      geografica: 'geográfica',
      mitologica: 'mitológica',
      estilistica: 'estilística',
      escenica: 'escénica',
      ecdotica: 'ecdótica',
      realia: 'realia'
    };

    // Construir badges de tipo/subtipo
    let badgesHTML = '';
    if (nota.type) {
      const normalizedType = typeMap[nota.type] || nota.type;
      badgesHTML += `<span class="note-badge note-badge-type">${normalizedType}</span>`;
    }
    if (nota.subtype) {
      const normalizedSubtype = typeMap[nota.subtype] || nota.subtype;
      badgesHTML += `<span class="note-badge note-badge-subtype">${normalizedSubtype}</span>`;
    }

    // Obtener estadisticas de evaluaciones
    const evaluaciones = typeof obtenerEvaluacionesStats === 'function'
      ? obtenerEvaluacionesStats(nota.nota_id, nota)
      : { total: 0, utiles: 0, mejorables: 0 };

    const mensajePrimero = evaluaciones.total === 0
      ? '<p class="eval-mensaje-primero">¡Sé el primero en evaluarla!</p>'
      : '';

    const noteDisplayHtml = `
      <div class="note-display" data-note-id="${nota.nota_id}">
        <div class="note-header">
          ${badgesHTML ? `<div class="note-badges">${badgesHTML}</div>` : ''}
        </div>
        <p class="fs-6">${nota.texto_nota}</p>
        <div class="note-footer"></div>
      </div>
    `;

    let dockHtml = '';
    if (yaEvaluada) {
      dockHtml = `
        <div class="nota-ya-evaluada">
          <i class="fa-solid fa-check-circle" aria-hidden="true"></i>
          Nota evaluada
        </div>
      `;
    } else {
      dockHtml = `
        <div class="nota-evaluacion" data-note-id="${nota.nota_id}">
          <div class="evaluacion-header">
            <span>¿Te resulta útil esta nota?</span>
          </div>
          <div class="evaluacion-botones">
            <button class="btn btn-outline-success btn-evaluar btn-util" data-nota-id="${nota.nota_id}" data-version="${nota.version}">
              <span class="btn-contador">${evaluaciones.utiles}</span>
              <i class="fa-solid fa-heart" aria-hidden="true"></i>
              Útil
            </button>
            <button class="btn btn-outline-danger btn-evaluar btn-mejorable" data-nota-id="${nota.nota_id}" data-version="${nota.version}">
              <span class="btn-contador">${evaluaciones.mejorables}</span>
              <i class="fa-solid fa-heart-crack" aria-hidden="true"></i>
              Mejorable
            </button>
          </div>
          <div class="evaluacion-comentario" style="display:none;">
            <textarea placeholder="[opcional] ¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota." rows="3"></textarea>
            <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
            <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
          </div>
        </div>
        ${mensajePrimero}
      `;
    }

    this.notaContent.innerHTML = `
      <div class="lab-note-layout">
        <div class="lab-note-display-scroll">
          ${noteDisplayHtml}
        </div>
        <div class="lab-note-eval-dock">
          ${dockHtml}
        </div>
      </div>
    `;

    // Adjuntar event listeners si no esta evaluada usando funcion reutilizable
    if (!yaEvaluada) {
      if (typeof attachEvaluationListeners === 'function') {
        const container = this.notaContent.querySelector('.lab-note-eval-dock') || this.notaContent;
        attachEvaluationListeners(
          container,
          nota.nota_id,
          nota.version,
          (nId, ver, vote, comment) => this.registrarEvaluacion(nId, ver, vote, comment, pasajeId),
          (nId, vote) => {
            this.marcarNotaComoEvaluada(nId);
            this.avanzarSiguienteNotaPendiente();
          }
        );
      } else {
        // Fallback a metodo legacy
        this.attachNotaListeners(nota, pasajeId);
      }
    }
  }
  /**
   * Adjuntar listeners a los botones de evaluacion (LEGACY)
   * @deprecated Usar attachEvaluationListeners de evaluaciones-stats.js
   */
  attachNotaListeners(nota, pasajeId) {
    const btnUtil = this.notaContent.querySelector('.btn-util');
    const btnMejorable = this.notaContent.querySelector('.btn-mejorable');
    const comentarioDiv = this.notaContent.querySelector('.evaluacion-comentario');
    const textarea = comentarioDiv?.querySelector('textarea');
    const btnEnviar = comentarioDiv?.querySelector('.btn-enviar-comentario');
    const btnCancelar = comentarioDiv?.querySelector('.btn-cancelar-comentario');

    // Boton "Util"
    btnUtil?.addEventListener('click', async () => {
      const exito = await this.registrarEvaluacion(
        nota.nota_id,
        nota.version,
        'up',
        null,
        pasajeId
      );

      if (exito) {
        // Actualizar contador local inmediatamente
        if (typeof actualizarContadorLocal === 'function') {
          actualizarContadorLocal(nota.nota_id, 'up');
        }
        this.marcarNotaComoEvaluada(nota.nota_id);
        this.avanzarSiguienteNotaPendiente();
      }
    });

    // Boton "Mejorable" - mostrar campo de comentario
    btnMejorable?.addEventListener('click', () => {
      if (comentarioDiv) {
        comentarioDiv.style.display = 'block';
        textarea?.focus();
      }
    });

    // Boton "Enviar comentario"
    btnEnviar?.addEventListener('click', async () => {
      const comentario = textarea?.value.trim() || null;
      const exito = await this.registrarEvaluacion(
        nota.nota_id,
        nota.version,
        'down',
        comentario,
        pasajeId
      );

      if (exito) {
        // Actualizar contador local inmediatamente
        if (typeof actualizarContadorLocal === 'function') {
          actualizarContadorLocal(nota.nota_id, 'down');
        }
        this.marcarNotaComoEvaluada(nota.nota_id);
        this.avanzarSiguienteNotaPendiente();
      }
    });

    // Boton "Cancelar"
    btnCancelar?.addEventListener('click', () => {
      if (comentarioDiv) {
        comentarioDiv.style.display = 'none';
        if (textarea) textarea.value = '';
      }
    });
  }

  /**
   * Marcar nota como evaluada
   */
  marcarNotaComoEvaluada(notaId) {
    this.notasEvaluadas.add(notaId);
    this.actualizarContadores();
    
    // Re-renderizar la nota actual para mostrar estado evaluado
    const nota = this.notasPasaje.find(n => n.nota_id === notaId);
    if (nota) {
      this.renderizarNotaActual(nota);
    }

    mostrarToast('Evaluación guardada', 2000);
  }

  /**
   * Avanzar a la siguiente nota pendiente de evaluar
   */
  avanzarSiguienteNotaPendiente() {
    // Buscar siguiente nota no evaluada
    for (let i = this.notaActualIndex + 1; i < this.notasPasaje.length; i++) {
      if (!this.notasEvaluadas.has(this.notasPasaje[i].nota_id)) {
        setTimeout(() => this.navegarANota(i), 500);
        return;
      }
    }

    // Si no hay mas, buscar desde el principio
    for (let i = 0; i < this.notaActualIndex; i++) {
      if (!this.notasEvaluadas.has(this.notasPasaje[i].nota_id)) {
        setTimeout(() => this.navegarANota(i), 500);
        return;
      }
    }

    // Todas evaluadas
    if (this.notasEvaluadas.size === this.notasPasaje.length) {
      setTimeout(() => {
        mostrarToast('¡Pasaje completado!', 3000);
      }, 600);
    }
  }

  /**
   * Actualizar contadores de notas
   */
  actualizarContadores() {
    const total = this.notasPasaje.length;
    const evaluadas = this.notasEvaluadas.size;

    document.getElementById('notas-totales').textContent = total;
    document.getElementById('notas-evaluadas').textContent = evaluadas;
    document.getElementById('notas-pasaje-total').textContent = total;
    
    if (this.notaActualIndex >= 0) {
      document.getElementById('nota-actual-index').textContent = this.notaActualIndex + 1;
    } else {
      document.getElementById('nota-actual-index').textContent = '0';
    }

    // Actualizar barra de progreso de notas tras cambiar contadores
    this.actualizarBarraProgresoNotas();
  }

  /**
   * Actualizar estado de botones de navegacion
   */
  actualizarBotonesNavegacion() {
    const btnAnterior = document.getElementById('btn-nota-anterior');
    const btnSiguiente = document.getElementById('btn-nota-siguiente');

    if (btnAnterior) {
      btnAnterior.disabled = this.notaActualIndex <= 0;
    }
    if (btnSiguiente) {
      btnSiguiente.disabled = this.notaActualIndex >= this.notasPasaje.length - 1;
    }
  }

  /**
   * Registrar evaluacion en Supabase
   */
  async registrarEvaluacion(notaId, version, vote, comentario, pasajeId) {
      const lockKey = String(notaId || '');
      if (lockKey && this.pendingEvaluations.has(lockKey)) {
        return false;
      }

      // Verificar modo de usuario
      if (!this.isModeDefined()) {
        await this.openParticipationModal({
          context: 'laboratorio-before-mode',
          reason: 'during-evaluation'
        });
      }

      const apiV2 = this.getApiV2();
      const sessionData = this.getSessionData();

      if (!apiV2 || !sessionData?.session_id) {
        console.error('No se pudo obtener datos de usuario');
        this.notifyFeedback('Error: modo no definido', 'error', 3000);
        return false;
      }

      if (lockKey) {
        this.pendingEvaluations.add(lockKey);
        this.setNoteEvaluationBusy(lockKey, true);
      }

      // La sesión ya está creada en BD (se creó al elegir modo)
      try {
        const { error } = await apiV2.submitNoteEvaluation({
          source: 'laboratorio',
          session_id: sessionData.session_id,
          pasaje_id: pasajeId,
          nota_id: notaId,
          nota_version: version,
          vote: vote,
          comment: comentario
        });

        if (error) {
          console.error('Error al registrar evaluación:', error);
          const message = this.getParticipationUserMessage(
            error,
            'evaluacion',
            'Error al enviar evaluación'
          );
          this.notifyFeedback(message || 'Error al enviar evaluación', 'error', 3000);
          return false;
        }

        // NO invalidamos caché aquí - actualizamos localmente en actualizarContadorLocal()
        console.log('Evaluación registrada:', vote, notaId);
        return true;
      } finally {
        if (lockKey) {
          this.pendingEvaluations.delete(lockKey);
          this.setNoteEvaluationBusy(lockKey, false);
        }
      }
    }

  setupModalCambiarModo() {
    if (!this.modalCambiarModo) return;

    const closeBtn = document.getElementById('modal-cambiar-modo-close');
    const cancelBtn = document.getElementById('btn-cancelar-cambiar-modo');
    const confirmBtn = document.getElementById('btn-confirmar-cambiar-modo');
    const overlay = this.modalCambiarModo.querySelector('.modal-overlay');

    closeBtn?.addEventListener('click', () => this.cerrarModalCambiarModo());
    cancelBtn?.addEventListener('click', () => this.cerrarModalCambiarModo());
    overlay?.addEventListener('click', () => this.cerrarModalCambiarModo());

    confirmBtn?.addEventListener('click', () => {
      this.cerrarModalCambiarModo();
      this.volverABienvenida();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalCambiarModo?.classList.contains('show')) {
        this.cerrarModalCambiarModo();
      }
    });
  }

  abrirModalCambiarModo() {
    if (!this.modalCambiarModo) return;
    this.modalCambiarModo.classList.add('show');
    document.getElementById('btn-cancelar-cambiar-modo')?.focus();
  }

  cerrarModalCambiarModo() {
    if (!this.modalCambiarModo) return;
    this.modalCambiarModo.classList.remove('show');
  }

  /**
   * Configurar event listeners de controles
   */
  setupEventListeners() {
    // Navegacion de notas
    document.getElementById('btn-nota-anterior')?.addEventListener('click', () => {
      if (this.notaActualIndex > 0) {
        this.navegarANota(this.notaActualIndex - 1);
      }
    });

    document.getElementById('btn-nota-siguiente')?.addEventListener('click', () => {
      if (this.notaActualIndex < this.notasPasaje.length - 1) {
        this.navegarANota(this.notaActualIndex + 1);
      } else if (this.notaActualIndex === -1 && this.notasPasaje.length > 0) {
        // Si no hay nota seleccionada, ir a la primera
        this.navegarANota(0);
      }
    });

    // Navegacion de pasajes
    document.getElementById('btn-anterior')?.addEventListener('click', () => {
      this.pasajeAnterior();
    });

    document.getElementById('btn-siguiente')?.addEventListener('click', () => {
      this.siguientePasaje();
    });

    // Botón cambiar modo
    this.setupModalCambiarModo();

    document.getElementById('btn-cambiar-modo')?.addEventListener('click', () => {
      this.abrirModalCambiarModo();
    });

    // Controles de zoom del pasaje
    document.getElementById('lab-font-increase')?.addEventListener('click', () => {
      this.intentarAumentarZoomSinOverflow();
    });

    document.getElementById('lab-font-decrease')?.addEventListener('click', () => {
      this.aplicarZoomPasaje(this.labFontSizePercent - this.labFontStep);
      this.ajustarZoomHastaNoOverflow();
    });

    // Revalidar overflow horizontal al cambiar tamano de viewport
    window.addEventListener('resize', () => {
      if (this.resizeAdjustTimer) {
        clearTimeout(this.resizeAdjustTimer);
      }

      this.resizeAdjustTimer = setTimeout(() => {
        this.ajustarZoomHastaNoOverflow();
      }, 120);
    }, { passive: true });

    // Actualizar botones iniciales
    this.actualizarBotonesNavegacion();
  }

  /**
   * Volver a la pantalla de bienvenida
   */
  volverABienvenida() {
    this.modoNavegacion = null;
    this.pasajesVisitados.clear();
    this.actualizarModoControlesFranja(null);
    this.mostrarPantallaBienvenida();
  }

  actualizarModoControlesFranja(modo) {
    const franja = document.querySelector('.laboratorio-controles-franja');
    if (!franja) return;

    if (modo) {
      franja.setAttribute('data-modo', modo);
    } else {
      franja.removeAttribute('data-modo');
    }
  }

  /**
   * Actualizar estado de botones de navegación de pasajes
   */
  actualizarBotonesNavegacionPasajes() {
    const btnAnterior = document.getElementById('btn-anterior');
    const btnSiguiente = document.getElementById('btn-siguiente');

    if (this.modoNavegacion === 'secuencial') {
      if (btnAnterior) {
        btnAnterior.disabled = this.pasajeActualIndex <= 0;
      }
      if (btnSiguiente) {
        btnSiguiente.disabled = this.pasajeActualIndex >= this.pasajes.length - 1;
        btnSiguiente.innerHTML = '<span>Siguiente</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
        btnSiguiente.setAttribute('aria-label', 'Siguiente pasaje');
      }
    } else if (this.modoNavegacion === 'aleatorio') {
      if (btnSiguiente) {
        btnSiguiente.disabled = false;
        btnSiguiente.innerHTML = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i><span>Otro aleatorio</span>';
        btnSiguiente.setAttribute('aria-label', 'Otro pasaje aleatorio');
      }
    }
  }

  /**
   * Ir al pasaje anterior (solo modo secuencial)
   */
  pasajeAnterior() {
    if (this.modoNavegacion !== 'secuencial') return;
    
    if (this.pasajeActualIndex > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.cargarPasaje(this.pasajeActualIndex - 1);
    }
  }

  /**
   * Ir al siguiente pasaje
   */
  siguientePasaje() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (this.modoNavegacion === 'secuencial') {
      this.cargarPasaje(this.pasajeActualIndex + 1);
    } else if (this.modoNavegacion === 'aleatorio') {
      this.cargarPasajeAleatorio();
    }
  }

  /**
   * Mostrar pantalla de finalizacion
   */
  mostrarFinalizacion() {
    const layout = document.querySelector('.laboratorio-layout');
    layout.innerHTML = `
      <div style="text-align: center; padding: 80px 20px; max-width: 600px; margin: 0 auto;">
        <h1 style="font-size: 3rem; color: var(--success); margin-bottom: 20px;">Felicidades!</h1>
        <p style="font-size: 1.5rem; color: var(--text-muted); margin-bottom: 30px;">
          Has completado todos los pasajes disponibles
        </p>
        <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 40px;">
          Gracias por tu contribucion al proyecto
        </p>
        <a href="../index.html" class="btn" style="font-size: 1.2rem; padding: 15px 40px;">
          Volver al inicio
        </a>
      </div>
    `;

    mostrarToast('Has completado todos los pasajes', 4000);
  }
}

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', async () => {
  window.editorSocial = new EditorSocial();
  await window.editorSocial.init();
});

console.log('Editor Social cargado');


