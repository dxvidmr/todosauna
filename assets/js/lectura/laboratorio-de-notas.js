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

    // Verificar si usuario tiene modo definido
    if (!window.userManager.tieneModoDefinido()) {
      await window.modalModo.mostrar();
    }

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
   * Mostrar pantalla de bienvenida
   */
  mostrarPantallaBienvenida() {
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
    if (this.bienvenidaContainer) {
      this.bienvenidaContainer.style.display = 'none';
    }
    if (this.laboratorioLayout) {
      this.laboratorioLayout.classList.add('active');
    }
  }

  /**
   * Setup listeners para botones de modo
   */
  setupBienvenidaListeners() {
    const opcionesModo = document.querySelectorAll('.opcion-modo');
    
    opcionesModo.forEach(opcion => {
      opcion.addEventListener('click', () => {
        const modo = opcion.dataset.modo;
        if (modo === 'secuencial') {
          this.iniciarModoSecuencial();
        } else if (modo === 'aleatorio') {
          this.iniciarModoAleatorio();
        }
      });
      
      // Accesibilidad: permitir Enter y Space para activar
      opcion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const modo = opcion.dataset.modo;
          if (modo === 'secuencial') {
            this.iniciarModoSecuencial();
          } else if (modo === 'aleatorio') {
            this.iniciarModoAleatorio();
          }
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
    
    // Actualizar badge de modo
    const badgeElement = document.getElementById('modo-actual-badge');
    if (badgeElement) {
      badgeElement.textContent = '📋 Secuencial';
    }
    
    // Mostrar barra de progreso
    const barraContainer = document.getElementById('barra-progreso-container');
    if (barraContainer) {
      barraContainer.style.display = 'block';
    }
    
    // Mostrar botón anterior
    const btnAnterior = document.getElementById('btn-anterior');
    if (btnAnterior) {
      btnAnterior.style.display = 'inline-block';
    }
    
    // Ocultar botón saltar (no necesario en modo secuencial)
    const btnSaltar = document.getElementById('btn-saltar');
    if (btnSaltar) {
      btnSaltar.style.display = 'none';
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
    
    // Actualizar badge de modo
    const badgeElement = document.getElementById('modo-actual-badge');
    if (badgeElement) {
      badgeElement.textContent = '🎲 Aleatorio';
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
    
    // Mostrar botón saltar
    const btnSaltar = document.getElementById('btn-saltar');
    if (btnSaltar) {
      btnSaltar.style.display = 'inline-block';
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
      if (confirm('Has visitado todos los pasajes. ¿Quieres volver a empezar?')) {
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
    const { data, error } = await window.supabaseClient
      .from('pasajes')
      .select('*')
      .order('orden', { ascending: true });

    if (error) {
      console.error('Error al cargar pasajes:', error);
      alert('Error al cargar pasajes. Verifica tu conexion.');
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
    titulo.textContent = pasaje.titulo;
    titulo.style.cssText = 'margin-bottom: 10px; color: var(--text); border-bottom: 2px solid var(--dark); padding-bottom: 10px;';
    this.pasajeContent.appendChild(titulo);

    // Anadir descripcion si existe
    if (pasaje.descripcion) {
      const descripcion = document.createElement('p');
      descripcion.textContent = pasaje.descripcion;
      descripcion.style.cssText = 'margin-bottom: 20px; color: var(--text-muted); font-style: italic; line-height: 1.6;';
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
    teiContainer.style.cssText = "font-family: 'Google Sans Code', 'Oxygen Mono', 'Source Code Pro', monospace; font-weight: 300; line-height: 1.8; font-size: 16px;";
    teiContainer.appendChild(htmlContent);

    this.pasajeContent.appendChild(teiContainer);

    // Aplicar alineacion de versos partidos y numeración de versos
    setTimeout(() => {
      alignSplitVerses(this.pasajeContent);
      aplicarNumeracionVersos(this.pasajeContent, 'cada5');
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
      this.notaContent.innerHTML = '<p class="placeholder-text">No hay notas en este pasaje</p>';
    } else {
      this.notaContent.innerHTML = '<p class="placeholder-text">Haz clic en un texto subrayado o usa las flechas para ver las notas</p>';
    }
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

    // Mapeo de tipologías normalizadas (igual que sala de lectura)
    const typeMap = {
      'lexica': 'léxica',
      'parafrasis': 'paráfrasis',
      'historica': 'histórica',
      'geografica': 'geográfica',
      'mitologica': 'mitológica',
      'estilistica': 'estilística',
      'escenica': 'escénica',
      'ecdotica': 'ecdótica',
      'realia': 'realia'
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

    // Obtener estadísticas de evaluaciones
    const evaluaciones = typeof obtenerEvaluacionesStats === 'function' 
      ? obtenerEvaluacionesStats(nota.nota_id, nota) 
      : { total: 0, utiles: 0, mejorables: 0 };
    
    // Mensaje si no hay evaluaciones
    const mensajePrimero = evaluaciones.total === 0 
      ? '<p class="eval-mensaje-primero">¡Sé el primero en evaluarla!</p>' 
      : '';

    // Contenido HTML de la nota (estructura igual a sala de lectura)
    let html = `
      <div class="note-display" data-note-id="${nota.nota_id}">
        <div class="note-header">
          ${badgesHTML ? `<div class="note-badges">${badgesHTML}</div>` : ''}
        </div>
        <p class="fs-6">${nota.texto_nota}</p>
        <div class="note-footer">
        </div>
      </div>
    `;

    // Mostrar botones de evaluacion o estado evaluado
    if (yaEvaluada) {
      html += `
        <div class="nota-ya-evaluada">
          <i class="fa-solid fa-check-circle" aria-hidden="true"></i>
          Nota evaluada
        </div>
      `;
    } else {
      html += `
        <div class="nota-evaluacion">
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
            <textarea placeholder="¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota (opcional)" rows="3"></textarea>
            <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
            <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
          </div>
        </div>
        ${mensajePrimero}
      `;
    }

    this.notaContent.innerHTML = html;

    // Adjuntar event listeners si no esta evaluada usando función reutilizable
    if (!yaEvaluada) {
      if (typeof attachEvaluationListeners === 'function') {
        const container = this.notaContent;
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
        // Fallback a método legacy
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

    mostrarToast('Evaluacion guardada', 2000);
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
        mostrarToast('Pasaje completado!', 3000);
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
        source: 'laboratorio',
        event_type: 'nota_eval',
        session_id: datosUsuario.session_id,
        pasaje_id: pasajeId,
        nota_id: notaId,
        nota_version: version,
        vote: vote,
        comment: comentario
      };

      const { error } = await window.supabaseClient
        .from('evaluaciones')
        .insert(evaluacion);

      if (error) {
        console.error('Error al registrar evaluacion:', error);
        mostrarToast('Error al enviar evaluacion', 3000);
        return false;
      }

      // NO invalidamos caché aquí - actualizamos localmente en actualizarContadorLocal()

      console.log('Evaluacion registrada:', vote, notaId);
      return true;
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

    document.getElementById('btn-saltar')?.addEventListener('click', () => {
      this.siguientePasaje();
    });

    // Botón cambiar modo
    document.getElementById('btn-cambiar-modo')?.addEventListener('click', () => {
      if (confirm('¿Quieres volver a la pantalla de selección de modo?')) {
        this.volverABienvenida();
      }
    });

    // Actualizar botones iniciales
    this.actualizarBotonesNavegacion();
  }

  /**
   * Volver a la pantalla de bienvenida
   */
  volverABienvenida() {
    this.modoNavegacion = null;
    this.pasajesVisitados.clear();
    this.mostrarPantallaBienvenida();
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
        btnSiguiente.innerHTML = '<i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Siguiente pasaje';
      }
    } else if (this.modoNavegacion === 'aleatorio') {
      if (btnSiguiente) {
        btnSiguiente.disabled = false;
        btnSiguiente.innerHTML = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i> Otro pasaje aleatorio';
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
