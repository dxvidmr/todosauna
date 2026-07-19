import { createTextZoomController } from './text-zoom.js';
import { aplicarNumeracionVersos, alignSplitVerses } from './utils.js';
import { cargarNotasActivas } from '../participacion/notas.js';
import { edicionEvaluacion } from '../participacion/lectura-evaluacion.js';
import {
    renderNoteEvalLoading,
    renderNotePanel,
    renderNotePlaceholder
} from '../shared/note-panel.js';
import { serializeNoteNodeHtml } from '../shared/tei-note-context.js';
import {
    createLecturaPanelLayoutController,
    LECTURA_PANEL_DESKTOP_BREAKPOINT
} from './lectura-panel-layout.js';
import { createNoteCategoryFilterController } from './note-category-filter.js';
import { createLecturaSearchController } from './lectura-search.js';
import {
    applyNoteHighlights,
    collectNoteTargetMeta,
    buildReadingOrderNoteIds,
    pickPrimaryNoteIdForClick,
    highlightAllRelatedGroups,
    buildNoteBadgesHTML,
    buildNoteDisplayHTML,
    hydrateCbRefsInContainer,
    markCurrentNoteInText,
    normalizeAnaCategories,
    readEffectiveNoteGroups
} from './notas-dom.js';

document.addEventListener("DOMContentLoaded", function() {
    // Referencias globales
    const lecturaWrapper = document.querySelector('.lectura-wrapper');
    const textColumn = document.querySelector('.text-column');
    
    // Estado de navegación de notas
    window.edicionNotas = {
        todasLasNotas: [],      // Array de xml:ids de notas
        notasVisibles: [],      // Notas incluidas por el filtro de tipologías
        notaActualIndex: -1,    // Índice de la nota actualmente mostrada
        notaActualId: null,     // ID de la nota actualmente mostrada
        metaPorNota: {}         // Metadata para orden de lectura y desempates de clic
    };
    let noteCategorySelection = {
        visibleNoteIds: null,
        selectedCategories: null,
        isFiltered: false
    };
    const lecturaNoteViewTracker = window.Participacion?.pilotTracking?.createNoteViewTracker
        ? window.Participacion.pilotTracking.createNoteViewTracker('lectura')
        : null;
    
    // ============================================
    // PANEL FLOTANTE - Sistema de apertura/cierre
    // ============================================
    
    const lecturaPanel = document.getElementById('lectura-panel');
    const tabsBar = document.getElementById('lectura-tabs-bar');
    const tabButtons = tabsBar ? tabsBar.querySelectorAll('.tab-button') : document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const btnCerrarPanel = document.getElementById('btn-cerrar-panel');
    const panelTitle = document.getElementById('lectura-panel-title');
    const panelHeaderActions = document.getElementById('lectura-panel-header-actions');
    const panelWrapper = document.getElementById('lectura-panel-wrapper');

    // Estado del panel
    let panelAbierto = false;
    let pestanaActiva = null;
    const panelLayout = createLecturaPanelLayoutController({
        wrapper: lecturaWrapper,
        textColumn,
        panel: lecturaPanel,
        panelWrapper,
        resizeHandle: document.getElementById('panel-resize-handle'),
        mobileDragHandle: document.querySelector('[data-lectura-panel-drag-handle]'),
        isOpen: () => panelAbierto,
        onMobileClose: () => cerrarPanel()
    });

    function getTabLabelText(tabName) {
        const tabButton = tabsBar?.querySelector(`[data-tab="${tabName}"]`);
        return tabButton?.querySelector('.tab-label')?.textContent?.trim() || '';
    }

    function updatePanelHeaderTitle(tabName) {
        if (!panelTitle) return;
        panelTitle.textContent = tabName ? getTabLabelText(tabName) : '';
    }

    function renderPanelHeaderActions() {
        if (!panelHeaderActions) return;

        const noteState = window.edicionNotas || {};
        const navigableNoteIds = getNavigableNoteIds();
        const totalNotas = navigableNoteIds.length;
        const currentIndex = Number.isInteger(noteState.notaActualIndex) ? noteState.notaActualIndex : -1;
        const hasActiveNote = pestanaActiva === 'notas' && panelAbierto && !!noteState.notaActualId && currentIndex >= 0 && totalNotas > 0;

        if (!hasActiveNote) {
            panelHeaderActions.innerHTML = '';
            panelHeaderActions.hidden = true;
            return;
        }

        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < totalNotas - 1;

        panelHeaderActions.hidden = false;
        panelHeaderActions.innerHTML = `
            <div class="note-nav-controls">
                <button class="btn-circular btn-nav-nota" id="btn-nota-prev" ${!hasPrev ? 'disabled' : ''} title="Nota anterior" aria-label="Nota anterior">
                    <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                </button>
                <span class="nota-posicion">Nota ${currentIndex + 1} de ${totalNotas}</span>
                <button class="btn-circular btn-nav-nota" id="btn-nota-next" ${!hasNext ? 'disabled' : ''} title="Nota siguiente" aria-label="Nota siguiente">
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
            </div>
        `;

        panelHeaderActions.querySelector('#btn-nota-prev')?.addEventListener('click', () => {
            navegarNota(-1, teiContainer, noteContentDiv);
        });

        panelHeaderActions.querySelector('#btn-nota-next')?.addEventListener('click', () => {
            navegarNota(1, teiContainer, noteContentDiv);
        });
    }

    function isEditableTarget(target) {
        if (!(target instanceof Element)) return false;
        return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]');
    }

    function canHandleNoteArrowNavigation(event) {
        if (event.defaultPrevented) return false;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
        if (!panelAbierto || pestanaActiva !== 'notas') return false;
        if (!window.edicionNotas?.notaActualId || window.edicionNotas?.notaActualIndex < 0) return false;
        if (isEditableTarget(event.target)) return false;
        return true;
    }
    
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

        panelLayout.resetMobileDrag();
        panelLayout.ensureOpenWidth();
        panelAbierto = true;
        pestanaActiva = tabName;
        updatePanelHeaderTitle(tabName);
        renderPanelHeaderActions();
        
        // Abrir el panel
        lecturaPanel.classList.add('open');
        panelLayout.requestInsetUpdate();
    }
    
    // Función para cerrar el panel
    function cerrarPanel() {
        if (!lecturaPanel) return;
        panelLayout.resetMobileDrag();
        
        lecturaPanel.classList.remove('open');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        panelAbierto = false;
        pestanaActiva = null;
        updatePanelHeaderTitle(null);
        renderPanelHeaderActions();
        panelLayout.requestInsetUpdate();
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

    document.addEventListener('keydown', function(event) {
        if (!canHandleNoteArrowNavigation(event)) return;

        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        event.preventDefault();
        navegarNota(direction, teiContainer, noteContentDiv);
    });

    document.addEventListener('pointerdown', function(event) {
        if (window.innerWidth >= LECTURA_PANEL_DESKTOP_BREAKPOINT || !panelAbierto || !panelWrapper) return;
        if (panelWrapper.contains(event.target)) return;
        cerrarPanel();
    });
    
    // Exponer funciones globalmente para uso desde otros módulos
    window.lecturaPanel = {
        abrir: abrirPanel,
        cerrar: cerrarPanel,
        toggle: togglePanel,
        estaAbierto: () => panelAbierto,
        getPestanaActiva: () => pestanaActiva
    };

    updatePanelHeaderTitle(null);
    renderPanelHeaderActions();
    panelLayout.requestInsetUpdate();
    
    panelLayout.bind();

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

    createTextZoomController({
        target: textColumn,
        increaseButton: document.getElementById('increase-font'),
        decreaseButton: document.getElementById('decrease-font'),
        display: document.getElementById('font-size-display')
    });
    
    // Control de numeración de versos
    const numeracionSelect = document.getElementById('numeracion-versos');
    if (numeracionSelect && textColumn) {
        numeracionSelect.addEventListener('change', function() {
            aplicarNumeracionVersos(textColumn, this.value);
        });
        
        // Preparar los versos una sola vez cuando el TEI esté cargado. La
        // alineación debe ejecutarse antes de insertar números auxiliares.
        const numeracionObserver = new MutationObserver(() => {
            if (textColumn.querySelector('tei-l[n]')) {
                alignSplitVerses(textColumn);
                aplicarNumeracionVersos(textColumn, numeracionSelect.value);
                numeracionObserver.disconnect();
            }
        });
        numeracionObserver.observe(textColumn, { childList: true, subtree: true });
    }

    const STANZA_MILESTONE_SELECTOR = [
        'tei-milestone[unit="stanza"]',
        'tei-milestone[unit="metrical-section"]',
        'tei-milestone[unit="metrical-subsection"]'
    ].join(', ');
    const METRICAL_UNIT_CONFIG = {
        stanza: {
            startClass: 'metrical-start-stanza',
            markerClass: 'stanza',
            labelClass: 'stanza'
        },
        'metrical-section': {
            startClass: 'metrical-start-section',
            markerClass: 'section',
            labelClass: 'section'
        },
        'metrical-subsection': {
            startClass: 'metrical-start-subsection',
            markerClass: 'subsection',
            labelClass: 'subsection'
        }
    };
    const METRICAL_START_CLASSES = Object.values(METRICAL_UNIT_CONFIG).map(config => config.startClass);
    const METRICAL_ACTIVE_VERSE_SELECTOR = METRICAL_START_CLASSES.map(className => `tei-l.${className}`).join(', ');

    function humanizeMetricalCategory(category) {
        return String(category || '')
            .trim()
            .replace(/^#/, '')
            .replace(/-/g, ' ');
    }

    function buildMetricalCategoryMap(container) {
        const map = new Map();
        if (!container) return map;

        const categories = container.querySelectorAll('tei-taxonomy tei-category');
        categories.forEach(category => {
            const categoryId = (category.getAttribute('xml:id') || category.getAttribute('id') || '').trim();
            if (!categoryId) return;

            const desc = category.querySelector('tei-catdesc')?.textContent?.trim();
            if (desc) {
                map.set(categoryId, desc);
            }
        });

        return map;
    }

    function ensureMetricalLabels(container) {
        if (!container) return;

        const categoryMap = buildMetricalCategoryMap(container);
        const milestones = container.querySelectorAll(STANZA_MILESTONE_SELECTOR);

        milestones.forEach(milestone => {
            const categories = normalizeAnaCategories(milestone.getAttribute('ana') || '');
            if (!categories.length) {
                milestone.removeAttribute('data-metrical-label');
                milestone.removeAttribute('title');
                return;
            }

            const label = categories
                .map(category => categoryMap.get(category) || humanizeMetricalCategory(category))
                .join(' · ');

            milestone.setAttribute('data-metrical-label', label);
            milestone.setAttribute('title', label);
        });
    }

    function clearRenderedMetricalDecorations(container) {
        if (!container) return;

        container.querySelectorAll('span[data-metrical-rendered="true"]').forEach(node => {
            node.remove();
        });
        if (!METRICAL_ACTIVE_VERSE_SELECTOR) return;

        container.querySelectorAll(METRICAL_ACTIVE_VERSE_SELECTOR).forEach(verse => {
            METRICAL_START_CLASSES.forEach(className => verse.classList.remove(className));
            verse.classList.remove('metrical-start-shared');
        });
    }

    function collectMetricalStarts(container) {
        if (!container) return [];

        const milestones = Array.from(container.querySelectorAll(STANZA_MILESTONE_SELECTOR));
        if (!milestones.length) return [];

        const orderedNodes = Array.from(container.querySelectorAll(`tei-l, ${STANZA_MILESTONE_SELECTOR}`));
        const firstVerseByMilestone = new WeakMap();
        let nextVerse = null;

        for (let index = orderedNodes.length - 1; index >= 0; index -= 1) {
            const node = orderedNodes[index];
            if (node.matches?.('tei-l')) {
                nextVerse = node;
                continue;
            }
            firstVerseByMilestone.set(node, nextVerse);
        }

        return milestones
            .map(milestone => ({
                milestone,
                targetVerse: firstVerseByMilestone.get(milestone) || null
            }))
            .filter(item => !!item.targetVerse);
    }

    function renderMetricalDecorations(container) {
        if (!container) return;

        const metricalStarts = collectMetricalStarts(container);
        if (!metricalStarts.length) return;

        const verseState = new Map();
        metricalStarts.forEach(({ milestone, targetVerse }) => {
            const unit = (milestone.getAttribute('unit') || '').trim();
            const config = METRICAL_UNIT_CONFIG[unit];
            if (!config || !targetVerse) return;

            let state = verseState.get(targetVerse);
            if (!state) {
                state = {
                    units: new Set(),
                    labels: Object.create(null)
                };
                verseState.set(targetVerse, state);
            }

            state.units.add(unit);

            const label = (milestone.getAttribute('data-metrical-label') || '').trim();
            if (label && !state.labels[unit]) {
                state.labels[unit] = label;
            }
        });

        verseState.forEach((state, verse) => {
            const units = Array.from(state.units);
            units.forEach(unit => {
                const config = METRICAL_UNIT_CONFIG[unit];
                if (!config) return;
                verse.classList.add(config.startClass);

                const marker = document.createElement('span');
                marker.className = `metrical-marker metrical-marker--${config.markerClass}`;
                marker.setAttribute('aria-hidden', 'true');
                marker.setAttribute('data-metrical-rendered', 'true');
                verse.appendChild(marker);
            });

            if (units.length > 1) {
                verse.classList.add('metrical-start-shared');
            }

            let labelIndex = 0;
            ['metrical-section', 'metrical-subsection', 'stanza'].forEach(unit => {
                const label = state.labels[unit];
                if (!label) return;

                const config = METRICAL_UNIT_CONFIG[unit];
                const labelNode = document.createElement('span');
                labelNode.className = `metrical-label metrical-label--${config.labelClass}`;
                labelNode.textContent = label;
                labelNode.setAttribute('title', label);
                labelNode.setAttribute('aria-hidden', 'true');
                labelNode.setAttribute('data-metrical-rendered', 'true');
                labelNode.style.setProperty('--metrical-label-index', String(labelIndex));
                labelIndex += 1;
                verse.appendChild(labelNode);
            });
        });
    }

    function prepareMetricalMilestones(container, visible) {
        const scope = container || teiContainer || document;
        if (!scope) return;

        ensureMetricalLabels(scope);
        clearRenderedMetricalDecorations(scope);

        if (visible) {
            renderMetricalDecorations(scope);
        }
    }

    function areMetricalDecorationsVisible(container) {
        const scope = container || teiContainer || document;
        if (!scope || !METRICAL_ACTIVE_VERSE_SELECTOR) return false;
        return !!scope.querySelector(METRICAL_ACTIVE_VERSE_SELECTOR);
    }

    function setStanzaSeparatorsVisible(visible, container) {
        prepareMetricalMilestones(container, !!visible);
    }
    
    // Botón para mostrar/ocultar estrofas
    const toggleStanzasCheckbox = document.getElementById('toggle-stanzas');
    if (toggleStanzasCheckbox) {
        toggleStanzasCheckbox.addEventListener('change', function() {
            setStanzaSeparatorsVisible(this.checked, teiContainer);
            if (toggleButton) {
                toggleButton.textContent = this.checked ? 'Ocultar estrofas' : 'Mostrar estrofas';
            }
        });
    }
    
    // Botón para mostrar/ocultar estrofas (legacy - mantener por compatibilidad)
    const toggleButton = document.getElementById("toggleLines");
    if (toggleButton) {
        toggleButton.addEventListener("click", function() {
            const shouldShow = !areMetricalDecorationsVisible(teiContainer);

            setStanzaSeparatorsVisible(shouldShow, teiContainer);
            this.textContent = shouldShow ? 'Ocultar estrofas' : 'Mostrar estrofas';

            if (toggleStanzasCheckbox) {
                toggleStanzasCheckbox.checked = shouldShow;
            }
        });
    }
    
    const teiContainer = document.getElementById("TEI");
    const noteContentDiv = document.getElementById("noteContent");
    const noteCategoryFilterController = createNoteCategoryFilterController({
        root: document.getElementById('note-category-filter'),
        optionsTabButton: tabsBar?.querySelector('[data-tab="opciones"]'),
        onChange: selection => {
            noteCategorySelection = selection;
            applyNoteCategoryFilter();
        }
    });
    const lecturaSearchController = createLecturaSearchController({
        form: document.getElementById('lectura-search-form'),
        input: document.getElementById('lectura-search-input'),
        clearButton: document.getElementById('lectura-search-clear'),
        status: document.getElementById('lectura-search-status'),
        results: document.getElementById('lectura-search-results'),
        textRoot: teiContainer,
        getNotesRoot: () => window.notasXML,
        getNavigableNoteIds,
        onOpenNote: noteId => {
            const noteNode = Array.from(window.notasXML?.getElementsByTagName('note') || [])
                .find(note => note.getAttribute('xml:id') === noteId || note.getAttribute('id') === noteId);
            if (!noteNode) return null;
            mostrarNotaEnPanel(noteNode, noteId, teiContainer, noteContentDiv);
            return teiContainer.querySelector(`[data-note-groups*="${noteId}"]`);
        }
    });
    
    let teiLoaded = false;
    let notasLoaded = false;
    let notasEvalLoaded = false;
    lecturaSearchController.bind();

    // Función para verificar si todo está listo y procesar
    async function checkAndProcess() {
        console.log('checkAndProcess:', { teiLoaded, notasLoaded, notasEvalLoaded, notasXML: !!window.notasXML });
        if (teiLoaded && notasLoaded && window.notasXML) {
            // Cargar metadata de evaluacion desde XML + Supabase
            if (!notasEvalLoaded) {
                await cargarNotasActivas({ notesDoc: window.notasXML });
                notasEvalLoaded = true;
            }
            
            console.log('Todo cargado, procesando notas...');
            processNotes();
            lecturaSearchController.initializeIndex();
            lecturaSearchController.consumePendingTarget();
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
                setStanzaSeparatorsVisible(!!toggleStanzasCheckbox?.checked, teiContainer);
                if (toggleButton) {
                    toggleButton.textContent = toggleStanzasCheckbox?.checked ? 'Ocultar estrofas' : 'Mostrar estrofas';
                }
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
        const metaPorNota = collectNoteTargetMeta(teiContainer, notes, {
            getTarget: note => note.getAttribute('target') || '',
            getNoteId: note => note.getAttribute('xml:id') || ''
        });
        const readingOrderIds = buildReadingOrderNoteIds(teiContainer, notes, {
            getTarget: note => note.getAttribute('target') || '',
            getNoteId: note => note.getAttribute('xml:id') || '',
            metaById: metaPorNota
        });

        applyNoteHighlights(teiContainer, notes, {
            getTarget: note => note.getAttribute('target') || '',
            getNoteId: note => note.getAttribute('xml:id') || '',
            propagateGroups: true,

            onWrapperClick: ({ wrapper, groups }) => {
                const activeGroup = pickPrimaryNoteIdForClick(groups, window.edicionNotas.metaPorNota);
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
                        const currentGroups = readEffectiveNoteGroups(wrapper);
                        const targetGroups = readEffectiveNoteGroups(targetWrapper);

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
        window.edicionNotas.metaPorNota = metaPorNota;
        window.edicionNotas.todasLasNotas = readingOrderIds;
        window.edicionNotas.notasVisibles = readingOrderIds.slice();
        noteCategoryFilterController.setNotes(notes);
        console.log(`Total de notas para navegación: ${window.edicionNotas.todasLasNotas.length}`);

        // ← AQUÍ VA TODO AL FINAL DE processNotes():
        console.log('Notas procesadas correctamente');

        // Inicializar sistema de evaluación
        void edicionEvaluacion.init();
    } // ← Fin de processNotes()

    function getNavigableNoteIds() {
        const noteState = window.edicionNotas || {};
        return Array.isArray(noteState.notasVisibles)
            ? noteState.notasVisibles
            : (Array.isArray(noteState.todasLasNotas) ? noteState.todasLasNotas : []);
    }

    function isNoteIdVisible(noteId) {
        if (!noteId) return false;
        if (!(noteCategorySelection.visibleNoteIds instanceof Set)) return true;
        return noteCategorySelection.visibleNoteIds.has(noteId);
    }

    function applyNoteCategoryFilter() {
        if (!teiContainer || !window.edicionNotas) return;

        const allNoteIds = Array.isArray(window.edicionNotas.todasLasNotas)
            ? window.edicionNotas.todasLasNotas
            : [];
        if (allNoteIds.length === 0) return;

        const visibleNoteIds = noteCategorySelection.visibleNoteIds instanceof Set
            ? noteCategorySelection.visibleNoteIds
            : new Set(allNoteIds);
        window.edicionNotas.notasVisibles = allNoteIds.filter(noteId => visibleNoteIds.has(noteId));

        teiContainer.querySelectorAll('[data-note-groups]').forEach(wrapper => {
            const allGroups = (wrapper.getAttribute('data-note-groups') || '').split(' ').filter(Boolean);
            const visibleGroups = allGroups.filter(noteId => visibleNoteIds.has(noteId));
            const mediaGroups = (wrapper.getAttribute('data-note-media-groups') || '').split(' ').filter(Boolean);
            const hasVisibleNote = visibleGroups.length > 0;
            const hasVisibleMedia = mediaGroups.some(noteId => visibleNoteIds.has(noteId));

            wrapper.setAttribute('data-visible-note-groups', visibleGroups.join(' '));
            wrapper.classList.toggle('note-filtered-out', !hasVisibleNote);
            wrapper.classList.toggle('note-target-has-media', hasVisibleNote && hasVisibleMedia);

            if (!hasVisibleNote) {
                wrapper.classList.remove('note-active', 'note-current');
            }
        });

        const currentNoteId = window.edicionNotas.notaActualId;
        if (currentNoteId && !visibleNoteIds.has(currentNoteId)) {
            cerrarNota(teiContainer, noteContentDiv);
        } else if (currentNoteId) {
            window.edicionNotas.notaActualIndex = window.edicionNotas.notasVisibles.indexOf(currentNoteId);
            renderPanelHeaderActions();
        } else {
            renderPanelHeaderActions();
        }

        lecturaSearchController.run();
    }

    function renderizarDockEvaluacionLoading() {
        return renderNoteEvalLoading();
    }

    function renderizarPlaceholderNota(noteContentDiv, mensaje) {
        renderNotePlaceholder(noteContentDiv, {
            bodyMessage: mensaje,
            dockState: 'idle'
        });
        void edicionEvaluacion.addEvaluationButtons(noteContentDiv);
        renderPanelHeaderActions();
    }
    
    // Función para mostrar nota en el panel con navegación
    function mostrarNotaEnPanel(noteToShow, noteXmlId, teiContainer, noteContentDiv) {
        if (!isNoteIdVisible(noteXmlId)) return false;

        // Abrir el panel en la pestaña de notas
        if (window.lecturaPanel) {
            window.lecturaPanel.abrir('notas');
        }
        
        const badgesHTML = buildNoteBadgesHTML(
            noteToShow.getAttribute('ana')
        );
        const noteChange = (noteToShow.getAttribute('change') || '').replace(/^#/, '');
        
        // Actualizar estado de navegación
        window.edicionNotas.notaActualId = noteXmlId;
        window.edicionNotas.notaActualIndex = getNavigableNoteIds().indexOf(noteXmlId);
        
        // Marcar nota activa en el texto (persistente)
        marcarNotaActivaEnTexto(noteXmlId, teiContainer);
         
        renderNotePanel(noteContentDiv, {
            currentNoteId: noteXmlId,
            currentNoteChange: noteChange,
            dockState: 'loading',
            bodyHTML: buildNoteDisplayHTML({
                noteId: noteXmlId,
                noteChange,
                text: serializeNoteNodeHtml(noteToShow),
                badgesHTML
            }),
            dockHTML: renderizarDockEvaluacionLoading()
        });
        if (lecturaNoteViewTracker) {
            lecturaNoteViewTracker.show({
                noteId: noteXmlId,
                noteChange,
                reason: 'note_changed'
            });
            if (edicionEvaluacion.estaEvaluada(noteXmlId, noteChange)) {
                lecturaNoteViewTracker.markEvaluated(noteXmlId, noteChange);
            }
        }
        void hydrateCbRefsInContainer(noteContentDiv);
        void edicionEvaluacion.addEvaluationButtons(noteContentDiv);
        renderPanelHeaderActions();
        return true;
    }
    
    // Función para navegar entre notas
    function navegarNota(direccion, teiContainer, noteContentDiv) {
        const navigableNoteIds = getNavigableNoteIds();
        const newIndex = window.edicionNotas.notaActualIndex + direccion;
        
        if (newIndex < 0 || newIndex >= navigableNoteIds.length) return;
        
        const newNoteId = navigableNoteIds[newIndex];
        
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
        lecturaNoteViewTracker?.flush('note_closed');

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
        renderPanelHeaderActions();
    }

    window.addEventListener('participacion:note-evaluated', (event) => {
        const detail = event?.detail;
        if (detail?.context && detail.context !== 'lectura') return;
        lecturaNoteViewTracker?.markEvaluated(detail?.noteId, detail?.noteChange);
    });

    window.addEventListener('pagehide', () => {
        lecturaNoteViewTracker?.flush('pagehide');
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            lecturaNoteViewTracker?.flush('visibility_hidden');
        }
    });
    
    // Función para marcar nota activa en el texto (persistente)
    function marcarNotaActivaEnTexto(noteId, teiContainer) {
        markCurrentNoteInText(teiContainer, noteId, { clearAllActive: false, autoScroll: false });
    }

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
