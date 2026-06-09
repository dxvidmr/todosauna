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
import { createBottomSheetDragController } from '../shared/bottom-sheet-drag.js';
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
    normalizeAnaCategories
} from './notas-dom.js';
import {
    SOURCE_TYPE_LABELS,
    buildIndex,
    groupResultsBySourceType,
    searchIndex
} from '../search/lunr-core.js';
import { buildLecturaSearchDocsFromSources } from '../search/lectura-search-docs.js';

document.addEventListener("DOMContentLoaded", function() {
    // Referencias globales
    const lecturaWrapper = document.querySelector('.lectura-wrapper');
    const textColumn = document.querySelector('.text-column');
    
    // Estado de navegación de notas
    window.edicionNotas = {
        todasLasNotas: [],      // Array de xml:ids de notas
        notaActualIndex: -1,    // Índice de la nota actualmente mostrada
        notaActualId: null,     // ID de la nota actualmente mostrada
        metaPorNota: {}         // Metadata para orden de lectura y desempates de clic
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
    let panelWrapper = null;
    const dynamicRecenterEnabled = lecturaWrapper?.dataset.lecturaDynamicRecenter === 'true';
    const lecturaPanelDesktopBreakpoint = 992;
    const lecturaPanelMinWidth = 320;
    const lecturaPanelDefaultMaxWidth = 800;

    function getLayoutTokenPx(token, fallback) {
        if (!lecturaWrapper) return fallback;
        const value = getComputedStyle(lecturaWrapper).getPropertyValue(token).trim();
        const px = parseFloat(value);
        return Number.isFinite(px) ? px : fallback;
    }

    function syncExpandedRailWidth() {
        if (!lecturaWrapper || !tabsBar) return;

        if (window.innerWidth < 992) {
            lecturaWrapper.style.removeProperty('--lectura-rail-expanded-width');
            return;
        }

        const previousTransition = tabsBar.style.transition;
        tabsBar.style.transition = 'none';
        tabsBar.classList.add('is-measuring');

        const measuredWidth = Math.ceil(tabsBar.getBoundingClientRect().width);

        tabsBar.classList.remove('is-measuring');
        tabsBar.style.transition = previousTransition;

        if (measuredWidth > 0) {
            lecturaWrapper.style.setProperty('--lectura-rail-expanded-width', `${measuredWidth}px`);
        }
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

    function getCollapsedRailWidth() {
        return getLayoutTokenPx('--lectura-rail-collapsed-width', 56);
    }

    function getStableOpenPanelFootprint() {
        const panelWidth = lecturaPanel?.offsetWidth || getLayoutTokenPx('--lectura-panel-open-min-width', 360);
        const panelGap = getLayoutTokenPx('--lectura-panel-gap-open', 32);
        return panelWidth + getCollapsedRailWidth() + panelGap;
    }

    function getStableClosedRailInset() {
        const railGap = getLayoutTokenPx('--lectura-panel-gap-closed', 24);
        return getCollapsedRailWidth() + railGap;
    }

    function updateDesktopTextInset() {
        if (!textColumn) return;

        const isDesktop = window.innerWidth >= 992;
        const isOpen = !!lecturaPanel?.classList.contains('open');
        lecturaWrapper?.classList.toggle('lectura-panel-open', isOpen);

        if (!isDesktop) {
            textColumn.style.paddingRight = '';
            textColumn.style.paddingLeft = '';
            return;
        }

        if (!dynamicRecenterEnabled) {
            textColumn.style.paddingLeft = '';
            if (isOpen) {
                textColumn.style.paddingRight = `${Math.round(getStableOpenPanelFootprint())}px`;
            } else {
                textColumn.style.paddingRight = `${Math.round(getStableClosedRailInset())}px`;
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

        const panelFootprint = getStableOpenPanelFootprint() + panelRightOffset + openRightSafety;
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
    let preferredPanelOpenWidth = null;
    let mobilePanelDragController = null;

    function getPanelOpenMaxWidth() {
        return dynamicRecenterEnabled
            ? getLayoutTokenPx('--lectura-panel-open-width-safe-max', 420)
            : lecturaPanelDefaultMaxWidth;
    }

    function getPanelInlineOpenWidth() {
        const width = parseFloat(panelWrapper?.style.getPropertyValue('--lectura-panel-open-width-inline'));
        return Number.isFinite(width) ? width : null;
    }

    function setPanelOpenWidth(width, { remember = false } = {}) {
        if (!panelWrapper || !Number.isFinite(width)) return;

        const clampedWidth = Math.min(Math.max(width, lecturaPanelMinWidth), getPanelOpenMaxWidth());
        panelWrapper.style.setProperty('--lectura-panel-open-width-inline', `${Math.round(clampedWidth)}px`);

        if (remember) {
            preferredPanelOpenWidth = clampedWidth;
        }
    }

    function ensurePanelOpenWidth() {
        if (!panelWrapper || window.innerWidth < lecturaPanelDesktopBreakpoint) return;

        if (Number.isFinite(preferredPanelOpenWidth)) {
            setPanelOpenWidth(preferredPanelOpenWidth);
            return;
        }

        if (Number.isFinite(getPanelInlineOpenWidth())) return;

        setPanelOpenWidth(getLayoutTokenPx('--lectura-panel-open-min-width', 360));
    }

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
        const totalNotas = Array.isArray(noteState.todasLasNotas) ? noteState.todasLasNotas.length : 0;
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

        mobilePanelDragController?.reset();
        ensurePanelOpenWidth();
        panelAbierto = true;
        pestanaActiva = tabName;
        updatePanelHeaderTitle(tabName);
        renderPanelHeaderActions();
        
        // Abrir el panel
        lecturaPanel.classList.add('open');
        requestDesktopTextInsetUpdate();
    }
    
    // Función para cerrar el panel
    function cerrarPanel() {
        if (!lecturaPanel) return;
        mobilePanelDragController?.reset();
        
        lecturaPanel.classList.remove('open');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        panelAbierto = false;
        pestanaActiva = null;
        updatePanelHeaderTitle(null);
        renderPanelHeaderActions();
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

    document.addEventListener('keydown', function(event) {
        if (!canHandleNoteArrowNavigation(event)) return;

        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        event.preventDefault();
        navegarNota(direction, teiContainer, noteContentDiv);
    });

    document.addEventListener('pointerdown', function(event) {
        if (window.innerWidth >= lecturaPanelDesktopBreakpoint || !panelAbierto || !panelWrapper) return;
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
    requestDesktopTextInsetUpdate();
    
    // ============================================
    // REDIMENSIONAMIENTO DEL PANEL (DRAG HANDLE)
    // ============================================
    
    const resizeHandle = document.getElementById('panel-resize-handle');
    const mobilePanelDragHandle = document.querySelector('[data-lectura-panel-drag-handle]');
    panelWrapper = document.getElementById('lectura-panel-wrapper');
    mobilePanelDragController = createBottomSheetDragController({
        sheet: () => lecturaPanel,
        handle: () => mobilePanelDragHandle,
        isEnabled: () => window.innerWidth < lecturaPanelDesktopBreakpoint && panelAbierto,
        onClose: () => {
            cerrarPanel();
        }
    }).bind();
    
    if (resizeHandle && panelWrapper) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        // Funcion para limpiar el width inline en tablet/movil
        function resetWidthOnResize() {
            if (window.innerWidth < lecturaPanelDesktopBreakpoint) {
                panelWrapper.style.removeProperty('--lectura-panel-open-width-inline');
            } else if (panelAbierto) {
                ensurePanelOpenWidth();
            }
            requestDesktopTextInsetUpdate();
        }

        // Limpiar width inline al cambiar tamano de ventana
        window.addEventListener('resize', resetWidthOnResize);

        // Solo habilitar drag en desktop
        if (window.innerWidth >= lecturaPanelDesktopBreakpoint) {
            resizeHandle.addEventListener('mousedown', function(e) {
                if (window.innerWidth < lecturaPanelDesktopBreakpoint) return; // Doble verificacion

                isResizing = true;
                startX = e.clientX;
                startWidth = getPanelInlineOpenWidth() || lecturaPanel?.offsetWidth || panelWrapper.offsetWidth;
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isResizing || window.innerWidth < lecturaPanelDesktopBreakpoint) return;

                const deltaX = startX - e.clientX; // Invertido porque el panel crece hacia la izquierda
                const newWidth = Math.min(Math.max(startWidth + deltaX, lecturaPanelMinWidth), getPanelOpenMaxWidth());

                setPanelOpenWidth(newWidth, { remember: true });

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

    syncExpandedRailWidth();
    if (document.fonts?.ready) {
        document.fonts.ready.then(() => {
            syncExpandedRailWidth();
            requestDesktopTextInsetUpdate();
        });
    }
    window.addEventListener('resize', () => {
        syncExpandedRailWidth();
    });

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
        
        // Aplicar numeración inicial cuando el TEI esté cargado
        const numeracionObserver = new MutationObserver(() => {
            if (textColumn.querySelector('tei-l[n]')) {
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
    const lecturaSearchForm = document.getElementById('lectura-search-form');
    const lecturaSearchInput = document.getElementById('lectura-search-input');
    const lecturaSearchClearButton = document.getElementById('lectura-search-clear');
    const lecturaSearchStatus = document.getElementById('lectura-search-status');
    const lecturaSearchResults = document.getElementById('lectura-search-results');
    
    let teiLoaded = false;
    let notasLoaded = false;
    let notasEvalLoaded = false;
    let lecturaSearchIndexState = null;
    let pendingSearchTarget = null;

    function parsePendingSearchTarget() {
        const params = new URLSearchParams(window.location.search || '');
        const rawTarget = String(params.get('ta_target') || '').trim();
        if (!rawTarget) return null;

        const [rawType, ...restParts] = rawTarget.split(':');
        const targetType = String(rawType || '').trim().toLowerCase();
        const targetId = restParts.join(':').trim();
        if (!targetType || !targetId) return null;
        if (targetType !== 'verse' && targetType !== 'note') return null;

        return { targetType, targetId };
    }

    function clearPendingSearchTargetFromUrl() {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('ta_target')) return;
        url.searchParams.delete('ta_target');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }

    pendingSearchTarget = parsePendingSearchTarget();
    bindLecturaSearchEvents();

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
            initializeLecturaSearchIndex();
            consumePendingSearchTarget();
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
        window.edicionNotas.metaPorNota = metaPorNota;
        window.edicionNotas.todasLasNotas = readingOrderIds;
        console.log(`Total de notas para navegación: ${window.edicionNotas.todasLasNotas.length}`);

        // ← AQUÍ VA TODO AL FINAL DE processNotes():
        console.log('Notas procesadas correctamente');

        // Inicializar sistema de evaluación
        void edicionEvaluacion.init();
    } // ← Fin de processNotes()

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
        window.edicionNotas.notaActualIndex = window.edicionNotas.todasLasNotas.indexOf(noteXmlId);
        
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

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeWhitespace(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function setLecturaSearchStatus(message) {
        if (!lecturaSearchStatus) return;
        lecturaSearchStatus.textContent = message || '';
    }

    function syncLecturaSearchClearButtonVisibility() {
        if (!(lecturaSearchInput instanceof HTMLInputElement) || !(lecturaSearchClearButton instanceof HTMLButtonElement)) return;
        const hasValue = !!normalizeWhitespace(lecturaSearchInput.value);
        lecturaSearchClearButton.hidden = !hasValue;
        lecturaSearchClearButton.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
    }

    function findNoteById(noteId) {
        if (!window.notasXML || !noteId) return null;
        const notes = window.notasXML.getElementsByTagName('note');
        for (let note of notes) {
            if (note.getAttribute('xml:id') === noteId || note.getAttribute('id') === noteId) {
                return note;
            }
        }
        return null;
    }

    function findVerseNodeById(verseId) {
        if (!teiContainer || !verseId) return null;
        const lines = teiContainer.querySelectorAll('tei-l');
        for (let line of lines) {
            const xmlId = line.getAttribute('xml:id') || '';
            const plainId = line.getAttribute('id') || '';
            if (xmlId === verseId || plainId === verseId) {
                return line;
            }
        }
        return null;
    }

    function flashSearchTarget(element) {
        if (!element) return;
        element.classList.add('search-target-hit');
        window.setTimeout(() => {
            element.classList.remove('search-target-hit');
        }, 1600);
    }

    function goToVerseTarget(verseId) {
        const verseNode = findVerseNodeById(verseId);
        if (!verseNode) return false;
        verseNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        flashSearchTarget(verseNode);
        return true;
    }

    function goToNoteTarget(noteId, options = {}) {
        const noteNode = findNoteById(noteId);
        if (!noteNode) return false;

        mostrarNotaEnPanel(noteNode, noteId, teiContainer, noteContentDiv);
        const wrapper = teiContainer.querySelector(`[data-note-groups*="${noteId}"]`);
        if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            if (options.flash !== false) {
                flashSearchTarget(wrapper);
            }
        }
        return true;
    }

    function consumePendingSearchTarget() {
        if (!pendingSearchTarget) return;

        const { targetType, targetId } = pendingSearchTarget;
        let resolved = false;
        if (targetType === 'verse') {
            resolved = goToVerseTarget(targetId);
        } else if (targetType === 'note') {
            resolved = goToNoteTarget(targetId, { flash: true });
        }

        if (resolved) {
            clearPendingSearchTargetFromUrl();
            pendingSearchTarget = null;
        }
    }

    function renderLecturaSearchEmpty(message) {
        if (!lecturaSearchResults) return;
        const safeMessage = normalizeWhitespace(message || '');
        if (!safeMessage) {
            lecturaSearchResults.innerHTML = '';
            return;
        }
        lecturaSearchResults.innerHTML = `<p class="lectura-search-empty">${escapeHtml(safeMessage)}</p>`;
    }

    function buildResultItemHtml(result) {
        const doc = result?.doc || {};
        const sourceLabel = SOURCE_TYPE_LABELS[doc.sourceType] || doc.sourceType || 'Resultado';
        const title = escapeHtml(doc.title || 'Sin título');
        const preview = escapeHtml(doc.preview || doc.body || '');
        const meta = escapeHtml(doc.meta || '');
        const targetType = escapeHtml(doc.targetType || '');
        const targetId = escapeHtml(doc.targetId || '');

        return `
            <button type="button" class="lectura-search-result-item" data-target-type="${targetType}" data-target-id="${targetId}">
                <span class="lectura-search-result-kind">${escapeHtml(sourceLabel)}</span>
                <span class="lectura-search-result-title">${title}</span>
                ${meta ? `<span class="lectura-search-result-meta">${meta}</span>` : ''}
                ${preview ? `<span class="lectura-search-result-preview">${preview}</span>` : ''}
            </button>
        `;
    }

    function renderLecturaSearchResults(results, query) {
        if (!lecturaSearchResults) return;

        if (!results.length) {
            renderLecturaSearchEmpty(`Sin resultados para "${query}".`);
            return;
        }

        const grouped = groupResultsBySourceType(results);
        const groupsMarkup = [];
        ['lectura-verse', 'lectura-note'].forEach(sourceType => {
            const items = grouped.get(sourceType);
            if (!items?.length) return;

            const itemsMarkup = items.map(buildResultItemHtml).join('');
            const label = SOURCE_TYPE_LABELS[sourceType] || sourceType;
            groupsMarkup.push(`
                <section class="lectura-search-group" data-source-type="${escapeHtml(sourceType)}">
                    <header class="lectura-search-group-head">
                        <h4>${escapeHtml(label)}</h4>
                        <span>${items.length}</span>
                    </header>
                    <div class="lectura-search-group-body">
                        ${itemsMarkup}
                    </div>
                </section>
            `);
        });

        lecturaSearchResults.innerHTML = groupsMarkup.join('');
    }

    function runLecturaSearch() {
        if (!lecturaSearchInput || !lecturaSearchIndexState) return;

        const query = normalizeWhitespace(lecturaSearchInput.value);
        syncLecturaSearchClearButtonVisibility();
        if (!query) {
            setLecturaSearchStatus('');
            renderLecturaSearchEmpty('');
            return;
        }

        const results = searchIndex(lecturaSearchIndexState, query, {
            limit: 40,
            sourceTypeBoost: {
                'lectura-verse': 1.06,
                'lectura-note': 1.14
            }
        });

        setLecturaSearchStatus(`${results.length} resultado(s) para "${query}".`);
        renderLecturaSearchResults(results, query);
    }

    function bindLecturaSearchEvents() {
        if (!(lecturaSearchForm instanceof HTMLFormElement) || !(lecturaSearchInput instanceof HTMLInputElement)) return;

        lecturaSearchForm.addEventListener('submit', event => {
            event.preventDefault();
            runLecturaSearch();
        });

        lecturaSearchInput.addEventListener('input', () => {
            syncLecturaSearchClearButtonVisibility();
            if (!normalizeWhitespace(lecturaSearchInput.value)) {
                setLecturaSearchStatus('');
                renderLecturaSearchEmpty('');
                return;
            }
            runLecturaSearch();
        });

        lecturaSearchClearButton?.addEventListener('click', () => {
            lecturaSearchInput.value = '';
            syncLecturaSearchClearButtonVisibility();
            setLecturaSearchStatus('');
            renderLecturaSearchEmpty('');
            lecturaSearchInput.focus();
        });

        lecturaSearchResults?.addEventListener('click', event => {
            const trigger = event.target instanceof Element
                ? event.target.closest('.lectura-search-result-item')
                : null;
            if (!trigger) return;

            const targetType = normalizeWhitespace(trigger.getAttribute('data-target-type'));
            const targetId = normalizeWhitespace(trigger.getAttribute('data-target-id'));
            if (!targetType || !targetId) return;

            if (targetType === 'verse') {
                goToVerseTarget(targetId);
                return;
            }

            if (targetType === 'note') {
                goToNoteTarget(targetId, { flash: false });
            }
        });

        syncLecturaSearchClearButtonVisibility();
    }

    function initializeLecturaSearchIndex() {
        if (!lecturaSearchInput || !lecturaSearchResults) return;

        if (typeof window.lunr !== 'function') {
            setLecturaSearchStatus('Lunr no está disponible en esta vista.');
            renderLecturaSearchEmpty('No se pudo activar la búsqueda en lectura.');
            return;
        }

        const docs = buildLecturaSearchDocsFromSources({
            textRoot: teiContainer,
            notesRoot: window.notasXML,
            baseUrl: '/lectura/'
        });

        if (!docs.length) {
            setLecturaSearchStatus('No hay contenido indexable todavía.');
            renderLecturaSearchEmpty('No hay contenido indexable todavía.');
            return;
        }

        lecturaSearchIndexState = buildIndex(docs, {
            fields: [
                { name: 'search_title', from: 'title', boost: 8 },
                { name: 'search_body', from: 'body', boost: 4 },
                { name: 'search_meta', from: 'meta', boost: 2 }
            ]
        });

        setLecturaSearchStatus('');
        renderLecturaSearchEmpty('');
        syncLecturaSearchClearButtonVisibility();
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
