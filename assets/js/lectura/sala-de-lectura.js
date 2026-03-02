import { aplicarNumeracionVersos, alignSplitVerses } from './utils.js';
import { cargarNotasActivas } from '../participacion/notas.js';
import {
    applyNoteHighlights,
    highlightAllRelatedGroups,
    buildNoteBadgesHTML,
    buildNoteDisplayHTML,
    markCurrentNoteInText,
    buildSkeletonLoadingHTML
} from './notas-dom.js';

document.addEventListener("DOMContentLoaded", function() {
    // Referencias globales
    const lecturaWrapper = document.querySelector('.lectura-wrapper');
    const textColumn = document.querySelector('.text-column');
    const fontSizeDisplay = document.getElementById('font-size-display');
    let currentFontSize = 100;
    
    // Estado de navegación de notas
    window.edicionNotas = {
        todasLasNotas: [],      // Array de xml:ids de notas
        notaActualIndex: -1,    // Índice de la nota actualmente mostrada
        notaActualId: null      // ID de la nota actualmente mostrada
    };
    
    // ============================================
    // PANEL FLOTANTE - Sistema de apertura/cierre
    // ============================================
    
    const lecturaPanel = document.getElementById('lectura-panel');
    const tabsBar = document.getElementById('lectura-tabs-bar');
    const tabButtons = tabsBar ? tabsBar.querySelectorAll('.tab-button') : document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const btnCerrarPanel = document.getElementById('btn-cerrar-panel');
    let panelWrapper = null;
    const dynamicRecenterEnabled = lecturaWrapper?.dataset.lecturaDynamicRecenter === 'true';

    function getLayoutTokenPx(token, fallback) {
        if (!lecturaWrapper) return fallback;
        const value = getComputedStyle(lecturaWrapper).getPropertyValue(token).trim();
        const px = parseFloat(value);
        return Number.isFinite(px) ? px : fallback;
    }

    function getCurrentTextPaddingLeftPx() {
        if (!textColumn) return 0;
        const value = getComputedStyle(textColumn).paddingLeft;
        const px = parseFloat(value);
        return Number.isFinite(px) ? px : 0;
    }

    function getBaseTextPaddingLeftPx() {
        if (!textColumn) return 0;
        const previousInlineLeft = textColumn.style.paddingLeft;
        textColumn.style.paddingLeft = '';
        const baseLeft = getCurrentTextPaddingLeftPx();
        textColumn.style.paddingLeft = previousInlineLeft;
        return baseLeft;
    }

    function updateDesktopTextInset() {
        if (!textColumn) return;

        const isDesktop = window.innerWidth >= 992;
        const isOpen = !!lecturaPanel?.classList.contains('open');
        lecturaWrapper?.classList.toggle('lectura-panel-open', isOpen);
        panelWrapper?.classList.toggle('is-open', isOpen);

        if (!isDesktop) {
            textColumn.style.paddingRight = '';
            textColumn.style.paddingLeft = '';
            return;
        }

        if (!dynamicRecenterEnabled) {
            textColumn.style.paddingLeft = '';
            if (isOpen) {
                const openGap = getLayoutTokenPx('--lectura-panel-gap-open', 32);
                const openInset = (panelWrapper?.offsetWidth || 0) + openGap;
                textColumn.style.paddingRight = `${Math.round(openInset)}px`;
            } else {
                const railGap = getLayoutTokenPx('--lectura-panel-gap-closed', 24);
                const railInset = (tabsBar?.offsetWidth || getLayoutTokenPx('--lectura-rail-collapsed-width', 56)) + railGap;
                textColumn.style.paddingRight = `${Math.round(railInset)}px`;
            }
            return;
        }

        const staticRightInset = getLayoutTokenPx('--lectura-static-right-inset', 560);
        const openLeftShiftBase = getLayoutTokenPx('--lectura-open-left-shift-base', 24);
        const textLeftMin = getLayoutTokenPx('--lectura-text-left-min', 40);
        const panelRightOffset = getLayoutTokenPx('--lectura-panel-right-offset', 20);
        const openRightSafety = getLayoutTokenPx('--lectura-open-right-safety', 16);

        if (!isOpen) {
            textColumn.style.paddingRight = '';
            textColumn.style.paddingLeft = '';
            return;
        }

        const panelFootprint = (panelWrapper?.offsetWidth || 0) + panelRightOffset + openRightSafety;
        const openRightInset = Math.max(staticRightInset, panelFootprint);
        const baseLeft = getBaseTextPaddingLeftPx();
        const openLeft = window.innerWidth >= 1600
            ? baseLeft
            : Math.max(
                textLeftMin,
                baseLeft - openLeftShiftBase
            );

        textColumn.style.paddingRight = `${Math.round(openRightInset)}px`;
        textColumn.style.paddingLeft = `${Math.round(openLeft)}px`;
    }

    let insetUpdateRaf = null;
    function requestDesktopTextInsetUpdate() {
        if (insetUpdateRaf) return;
        insetUpdateRaf = requestAnimationFrame(() => {
            insetUpdateRaf = null;
            updateDesktopTextInset();
        });
    }
    
    // Estado del panel
    let panelAbierto = false;
    let pestanaActiva = null;
    
    // Función para abrir el panel
    function abrirPanel(tabName) {
        if (!lecturaPanel) return;
        
        // Activar la pestaña correspondiente
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        const targetTab = document.getElementById('tab-' + tabName);
        const targetButton = tabsBar?.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetTab) targetTab.classList.add('active');
        if (targetButton) targetButton.classList.add('active');

        const openMin = getLayoutTokenPx('--lectura-panel-open-min-width', 360);
        panelWrapper?.style.setProperty('--lectura-panel-open-width-inline', `${Math.round(openMin)}px`);
        
        // Abrir el panel
        lecturaPanel.classList.add('open');
        panelAbierto = true;
        pestanaActiva = tabName;
        requestDesktopTextInsetUpdate();
    }
    
    // Función para cerrar el panel
    function cerrarPanel() {
        if (!lecturaPanel) return;
        
        lecturaPanel.classList.remove('open');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        panelAbierto = false;
        pestanaActiva = null;
        requestDesktopTextInsetUpdate();
    }
    
    // Función para toggle del panel
    function togglePanel(tabName) {
        if (panelAbierto && pestanaActiva === tabName) {
            // Si está abierto en la misma pestaña, cerrar
            cerrarPanel();
        } else {
            // Si está cerrado o en otra pestaña, abrir
            abrirPanel(tabName);
        }
    }
    
    // Event listeners para pestañas
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            togglePanel(tabName);
        });
    });
    
    // Event listener para botón de cerrar
    btnCerrarPanel?.addEventListener('click', cerrarPanel);
    
    // Exponer funciones globalmente para uso desde otros módulos
    window.lecturaPanel = {
        abrir: abrirPanel,
        cerrar: cerrarPanel,
        toggle: togglePanel,
        estaAbierto: () => panelAbierto,
        getPestanaActiva: () => pestanaActiva
    };
    
    requestDesktopTextInsetUpdate();
    
    // ============================================
    // REDIMENSIONAMIENTO DEL PANEL (DRAG HANDLE)
    // ============================================
    
    const resizeHandle = document.getElementById('panel-resize-handle');
    panelWrapper = document.getElementById('lectura-panel-wrapper');

    if (panelWrapper) {
        ['mouseenter', 'mouseleave', 'focusin', 'focusout'].forEach((eventName) => {
            panelWrapper.addEventListener(eventName, requestDesktopTextInsetUpdate);
        });
    }

    tabsBar?.addEventListener('transitionend', function(event) {
        if (
            event.propertyName === 'width' ||
            event.propertyName === 'inline-size' ||
            event.propertyName === 'max-width' ||
            event.propertyName === 'padding-left' ||
            event.propertyName === 'padding-right'
        ) {
            requestDesktopTextInsetUpdate();
        }
    });
    
    if (resizeHandle && panelWrapper) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        const minWidth = 320;
        const defaultMaxWidth = 800;

        // Funcion para limpiar el width inline en tablet/movil
        function resetWidthOnResize() {
            if (window.innerWidth < 992) {
                panelWrapper.style.removeProperty('--lectura-panel-open-width-inline');
            }
            requestDesktopTextInsetUpdate();
        }

        // Limpiar width inline al cambiar tamano de ventana
        window.addEventListener('resize', resetWidthOnResize);

        // Solo habilitar drag en desktop
        if (window.innerWidth >= 992) {
            resizeHandle.addEventListener('mousedown', function(e) {
                if (window.innerWidth < 992) return; // Doble verificacion

                isResizing = true;
                startX = e.clientX;
                const currentVarWidth = parseFloat(panelWrapper.style.getPropertyValue('--lectura-panel-open-width-inline'));
                startWidth = Number.isFinite(currentVarWidth) ? currentVarWidth : (lecturaPanel?.offsetWidth || panelWrapper.offsetWidth);
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isResizing || window.innerWidth < 992) return;

                const deltaX = startX - e.clientX; // Invertido porque el panel crece hacia la izquierda
                const maxWidth = dynamicRecenterEnabled
                    ? getLayoutTokenPx('--lectura-panel-open-width-safe-max', 420)
                    : defaultMaxWidth;
                const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);

                panelWrapper.style.setProperty('--lectura-panel-open-width-inline', `${Math.round(newWidth)}px`);

                // Mantener comportamiento anterior cuando el recenter dinamico esta desactivado
                if (!dynamicRecenterEnabled && textColumn) {
                    textColumn.style.paddingRight = (newWidth + 100) + 'px';
                }
                requestDesktopTextInsetUpdate();
            });

            document.addEventListener('mouseup', function() {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    requestDesktopTextInsetUpdate();
                }
            });
        }
    }

    // ============================================
    // CONTROLES DE LECTURA
    // ============================================
    
    // Control de visibilidad de notas
    const toggleNotesCheckbox = document.getElementById('toggle-notes');
    if (toggleNotesCheckbox && textColumn) {
        toggleNotesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                textColumn.classList.remove('notes-hidden');
            } else {
                textColumn.classList.add('notes-hidden');
            }
        });
    }
    
    // Control de tamaño de fuente
    document.getElementById('increase-font')?.addEventListener('click', function() {
        if (currentFontSize < 150) {
            currentFontSize += 10;
            updateFontSize();
        }
    });
    
    document.getElementById('decrease-font')?.addEventListener('click', function() {
        if (currentFontSize > 70) {
            currentFontSize -= 10;
            updateFontSize();
        }
    });
    
    function updateFontSize() {
        if (textColumn && fontSizeDisplay) {
            textColumn.style.fontSize = currentFontSize + '%';
            fontSizeDisplay.textContent = currentFontSize + '%';
        }
    }
    
    // Control de numeración de versos
    const numeracionSelect = document.getElementById('numeracion-versos');
    if (numeracionSelect && textColumn) {
        numeracionSelect.addEventListener('change', function() {
            aplicarNumeracionVersos(textColumn, this.value);
        });
        
        // Aplicar numeración inicial cuando el TEI esté cargado
        const numeracionObserver = new MutationObserver(() => {
            if (textColumn.querySelector('tei-l[n]')) {
                aplicarNumeracionVersos(textColumn, numeracionSelect.value);
                numeracionObserver.disconnect();
            }
        });
        numeracionObserver.observe(textColumn, { childList: true, subtree: true });
    }
    
    // Botón para mostrar/ocultar estrofas
    const toggleStanzasCheckbox = document.getElementById('toggle-stanzas');
    if (toggleStanzasCheckbox) {
        toggleStanzasCheckbox.addEventListener('change', function() {
            var milestones = document.querySelectorAll('tei-milestone[unit="stanza"]');
            milestones.forEach(function(milestone) {
                if (this.checked) {
                    milestone.classList.add('show-line');
                } else {
                    milestone.classList.remove('show-line');
                }
            }.bind(this));
        });
    }
    
    // Botón para mostrar/ocultar estrofas (legacy - mantener por compatibilidad)
    const toggleButton = document.getElementById("toggleLines");
    if (toggleButton) {
        toggleButton.addEventListener("click", function() {
            var milestones = document.querySelectorAll('tei-milestone[unit="stanza"]');
            milestones.forEach(function(milestone) {
                milestone.classList.toggle('show-line');
            });

            // Cambia el texto del botón
            if (this.textContent === "Mostrar estrofas") {
                this.textContent = "Ocultar estrofas";
            } else {
                this.textContent = "Mostrar estrofas";
            }
        });
    }
    
    const teiContainer = document.getElementById("TEI");
    const noteContentDiv = document.getElementById("noteContent");
    
    let teiLoaded = false;
    let notasLoaded = false;
    let notasSupabaseLoaded = false;

    // Función para verificar si todo está listo y procesar
    async function checkAndProcess() {
        console.log('checkAndProcess:', { teiLoaded, notasLoaded, notasSupabaseLoaded, notasXML: !!window.notasXML });
        if (teiLoaded && notasLoaded && window.notasXML) {
            // Cargar notas desde Supabase (para obtener contadores de evaluaciones)
            if (!notasSupabaseLoaded) {
                console.log('Cargando notas desde Supabase...');
                await cargarNotasActivas();
                notasSupabaseLoaded = true;
                console.log('✓ Notas de Supabase cargadas con contadores');
            }
            
            console.log('Todo cargado, procesando notas...');
            processNotes();
            // ← NOTA: Ya NO ponemos nada aquí, todo va dentro de processNotes()
        }
    }

    // Observa cuando se añadan nodos al contenedor #TEI
    const observer = new MutationObserver(() => {
        // Verificar si el contenido TEI ya está cargado (buscar elementos tei-)
        if (teiContainer.querySelector('tei-l, tei-seg')) {
            if (!teiLoaded) {
                teiLoaded = true;
                console.log('TEI cargado');
                observer.disconnect();
                checkAndProcess();
            }
        }
    });

    // Inicia la observación en el contenedor TEI
    observer.observe(teiContainer, { childList: true, subtree: true });
    
    // Esperar a que las notas se carguen
    const checkNotas = setInterval(() => {
        if (window.notasXML && !notasLoaded) {
            notasLoaded = true;
            console.log('Notas cargadas');
            clearInterval(checkNotas);
            checkAndProcess();
        }
    }, 100);

    function processNotes() {
        if (!window.notasXML) return;

        // Obtener todas las notas del XML externo
        const notes = Array.from(window.notasXML.querySelectorAll('note'));

        const processedIds = applyNoteHighlights(teiContainer, notes, {
            getTarget: note => note.getAttribute('target') || '',
            getNoteId: note => note.getAttribute('xml:id') || '',
            propagateGroups: true,

            onWrapperClick: ({ wrapper, groups }) => {
                const activeGroup = groups[0];
                if (!activeGroup) return;

                console.log('Click en elemento, mostrando nota:', activeGroup);

                // Buscar la nota en el XML
                let noteToShow = null;
                const allNotes = window.notasXML.getElementsByTagName('note');
                for (let note of allNotes) {
                    if (note.getAttribute('xml:id') === activeGroup) {
                        noteToShow = note;
                        break;
                    }
                }

                if (noteToShow) {
                    mostrarNotaEnPanel(noteToShow, activeGroup, teiContainer, noteContentDiv);
                } else {
                    renderizarPlaceholderNota(
                        noteContentDiv,
                        'Nota no encontrada.'
                    );
                    console.error('No se encontró nota con xml:id:', activeGroup);
                }
            },

            onWrapperEnter: ({ wrapper }) => {
                highlightAllRelatedGroups(teiContainer, wrapper, true);
            },

            onWrapperLeave: ({ wrapper, event }) => {
                // Verificar si el destino del ratón es un wrapper relacionado
                const relatedTarget = event.relatedTarget;

                if (relatedTarget) {
                    const targetWrapper = relatedTarget.closest('.note-wrapper');
                    if (targetWrapper) {
                        const currentGroups = (wrapper.getAttribute('data-note-groups') || '').split(' ').filter(g => g);
                        const targetGroups = (targetWrapper.getAttribute('data-note-groups') || '').split(' ').filter(g => g);

                        // Si comparten algún grupo, no desactivar
                        if (currentGroups.some(g => targetGroups.includes(g))) {
                            return;
                        }
                    }
                }

                // Si no hay destino relacionado, desactivar todo
                teiContainer.querySelectorAll('.note-active').forEach(el => el.classList.remove('note-active'));
            }
        });

        // Guardar lista de todas las notas para navegación
        window.edicionNotas.todasLasNotas = processedIds;
        console.log(`Total de notas para navegación: ${window.edicionNotas.todasLasNotas.length}`);

        // ← AQUÍ VA TODO AL FINAL DE processNotes():
        console.log('Notas procesadas correctamente');

        // Inicializar sistema de evaluación
        if (window.edicionEvaluacion) {
            window.edicionEvaluacion.init();
        }
    } // ← Fin de processNotes()

    function renderizarDockEvaluacionLoading() {
        return buildSkeletonLoadingHTML();
    }

    function renderizarPlaceholderNota(noteContentDiv, mensaje) {
        noteContentDiv.dataset.currentNoteId = '';
        noteContentDiv.innerHTML = `
            <div class="lectura-note-layout">
                <div class="lectura-note-header"></div>
                <div class="lectura-note-scroll">
                    <p class="placeholder-text">${mensaje}</p>
                </div>
                <div class="lectura-note-eval-dock" data-eval-state="idle">
                    <p class="lectura-note-dock-placeholder"></p>
                </div>
            </div>
        `;
    }
    
    // Función para mostrar nota en el panel con navegación
    function mostrarNotaEnPanel(noteToShow, noteXmlId, teiContainer, noteContentDiv) {
        // Abrir el panel en la pestaña de notas
        if (window.lecturaPanel) {
            window.lecturaPanel.abrir('notas');
        }
        
        const badgesHTML = buildNoteBadgesHTML(
            noteToShow.getAttribute('type'),
            noteToShow.getAttribute('subtype')
        );
        
        // Actualizar estado de navegación
        window.edicionNotas.notaActualId = noteXmlId;
        window.edicionNotas.notaActualIndex = window.edicionNotas.todasLasNotas.indexOf(noteXmlId);
        
        const currentIndex = window.edicionNotas.notaActualIndex;
        const totalNotas = window.edicionNotas.todasLasNotas.length;
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < totalNotas - 1;
        
        // Marcar nota activa en el texto (persistente)
        marcarNotaActivaEnTexto(noteXmlId, teiContainer);
        
        noteContentDiv.dataset.currentNoteId = noteXmlId;
        noteContentDiv.innerHTML = `
            <div class="lectura-note-layout">
                <div class="lectura-note-header">
                    <div class="note-nav-controls">
                        <button class="btn-circular btn-nav-nota" id="btn-nota-prev" ${!hasPrev ? 'disabled' : ''} title="Nota anterior">
                            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                        </button>
                        <span class="nota-posicion">Nota ${currentIndex + 1} de ${totalNotas}</span>
                        <button class="btn-circular btn-nav-nota" id="btn-nota-next" ${!hasNext ? 'disabled' : ''} title="Nota siguiente">
                            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="lectura-note-scroll">
                    ${buildNoteDisplayHTML({ noteId: noteXmlId, text: noteToShow.textContent.trim(), badgesHTML })}
                </div>
                <div class="lectura-note-eval-dock" data-eval-state="loading">
                    ${renderizarDockEvaluacionLoading()}
                </div>
            </div>
        `;
        
        // Añadir event listeners para navegación
        document.getElementById('btn-nota-prev')?.addEventListener('click', () => {
            navegarNota(-1, teiContainer, noteContentDiv);
        });
        
        document.getElementById('btn-nota-next')?.addEventListener('click', () => {
            navegarNota(1, teiContainer, noteContentDiv);
        });
    }
    
    // Función para navegar entre notas
    function navegarNota(direccion, teiContainer, noteContentDiv) {
        const newIndex = window.edicionNotas.notaActualIndex + direccion;
        
        if (newIndex < 0 || newIndex >= window.edicionNotas.todasLasNotas.length) return;
        
        const newNoteId = window.edicionNotas.todasLasNotas[newIndex];
        
        // Buscar la nota en el XML
        const allNotes = window.notasXML.getElementsByTagName('note');
        let noteToShow = null;
        for (let note of allNotes) {
            if (note.getAttribute('xml:id') === newNoteId) {
                noteToShow = note;
                break;
            }
        }
        
        if (noteToShow) {
            mostrarNotaEnPanel(noteToShow, newNoteId, teiContainer, noteContentDiv);
            
            // Scroll al elemento en el texto
            const wrapper = teiContainer.querySelector(`[data-note-groups*="${newNoteId}"]`);
            if (wrapper) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    // Función para cerrar la nota (resetea el estado)
    function cerrarNota(teiContainer, noteContentDiv) {
        // Quitar highlight activo
        teiContainer.querySelectorAll('.note-current').forEach(el => {
            el.classList.remove('note-current', 'note-active');
        });
        
        // Resetear estado
        window.edicionNotas.notaActualId = null;
        window.edicionNotas.notaActualIndex = -1;
        
        // Mostrar placeholder
        renderizarPlaceholderNota(
            noteContentDiv,
            'Haz clic en el texto subrayado para ver las notas.'
        );
    }
    
    // Función para marcar nota activa en el texto (persistente)
    function marcarNotaActivaEnTexto(noteId, teiContainer) {
        markCurrentNoteInText(teiContainer, noteId, { clearAllActive: false, autoScroll: false });
    }
    
    
    // Llamar a la función de alineación después de que el TEI esté cargado
    const verseObserver = new MutationObserver(() => {
        if (teiContainer.querySelector('tei-l[part]')) {
            alignSplitVerses(teiContainer);
            verseObserver.disconnect();
        }
    });
    
    verseObserver.observe(teiContainer, { childList: true, subtree: true });

    
    /**
     * Navegación por índice
     */
    function initializeNavigation() {
        const navButtons = document.querySelectorAll('.btn-nav-item');
        
        navButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Obtener atributos del botón
                const targetType = this.getAttribute('data-target-type'); // 'head' o 'div'
                const targetAttr = this.getAttribute('data-target-attr'); // 'type' o 'n'
                const targetValue = this.getAttribute('data-target-value'); // valor del atributo
                
                // Construir selector
                let selector;
                if (targetType === 'div') {
                    // Para actos: tei-div[type="act"][n="1"]
                    selector = `tei-div[type="act"][${targetAttr}="${targetValue}"]`;
                } else if (targetType === 'head') {
                    // Para título y dramatis: tei-head[type="comedia-head"]
                    selector = `tei-${targetType}[${targetAttr}="${targetValue}"]`;
                }
                
                // Buscar elemento
                const targetElement = teiContainer.querySelector(selector);
                
                if (targetElement) {
                    // Remover clase active de todos los botones
                    navButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Agregar clase active al botón clickeado
                    this.classList.add('active');
                    
                    // Hacer scroll al elemento
                    targetElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start',
                        inline: 'nearest'
                    });
                    
                    console.log('✓ Navegado a:', selector);
                } else {
                    console.warn('⚠ No se encontró el elemento:', selector);
                    console.log('Contenedor TEI:', teiContainer);
                }
            });
        });
        
        console.log('✓ Navegación por índice inicializada');
        
        // Detectar sección actual al scroll
        const textColumn = document.querySelector('.text-column');
        const sections = [
            { type: 'head', attr: 'type', value: 'comedia-head' },
            { type: 'head', attr: 'type', value: 'castList-head' },
            { type: 'div', attr: 'n', value: '1' },
            { type: 'div', attr: 'n', value: '2' },
            { type: 'div', attr: 'n', value: '3' }
        ];
        
        textColumn.addEventListener('scroll', () => {
            let currentSection = null;
            let minDistance = Infinity;
            
            sections.forEach(section => {
                let selector;
                if (section.type === 'div') {
                    selector = `tei-div[type="act"][${section.attr}="${section.value}"]`;
                } else if (section.type === 'head') {
                    selector = `tei-${section.type}[${section.attr}="${section.value}"]`;
                }
                
                const element = teiContainer.querySelector(selector);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const textRect = textColumn.getBoundingClientRect();
                    const distance = Math.abs(rect.top - textRect.top);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        currentSection = section;
                    }
                }
            });
            
            if (currentSection) {
                navButtons.forEach(btn => {
                    const btnType = btn.getAttribute('data-target-type');
                    const btnAttr = btn.getAttribute('data-target-attr');
                    const btnValue = btn.getAttribute('data-target-value');
                    
                    if (btnType === currentSection.type && btnAttr === currentSection.attr && btnValue === currentSection.value) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        });
    }
    
    /**
     * Observer para esperar a que el TEI esté completamente cargado
     * Una vez detecte elementos TEI, inicializa la navegación
     */
    const teiObserver = new MutationObserver((mutations, obs) => {
        // Verificar si ya hay elementos TEI cargados
        const hasTeiContent = teiContainer.querySelector('tei-div[type="act"]') || 
                             teiContainer.querySelector('tei-head');
        
        if (hasTeiContent) {
            console.log('✓ Contenido TEI detectado, inicializando navegación...');
            
            // Pequeño delay para asegurar que todo el DOM esté renderizado
            setTimeout(() => {
                initializeNavigation();
                obs.disconnect(); // Dejar de observar
            }, 100);
        }
    });
    
    // Iniciar observación
    teiObserver.observe(teiContainer, { 
        childList: true, 
        subtree: true 
    });
    
    // Fallback: Si el TEI ya está cargado cuando se ejecuta el script
    if (teiContainer.querySelector('tei-div[type="act"]') || 
        teiContainer.querySelector('tei-head')) {
        console.log('✓ TEI ya estaba cargado, inicializando navegación...');
        setTimeout(initializeNavigation, 100);
    }
});
